mod autofill;
mod config;
mod crypto;
mod detector;
mod mappings;
mod security;

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, PhysicalPosition, LogicalSize, RunEvent, Size, WindowEvent,
};
use zeroize::Zeroizing;

use config::{load_config, save_config, AppConfig, PairedUser};
use crypto::{
    decrypt_relay_payload, generate_ephemeral_session, DecryptedLoginData, DecryptedPairingData,
    EphemeralSession, RelayPayload, SecretCredentials,
};
use detector::{
    calculate_overlay_position, get_foreground_window, get_window_by_hwnd, get_window_rect,
    is_own_foreground, is_window_valid, list_visible_windows, DetectedWindow,
};
use mappings::{find_matching_mapping, load_mappings, save_mappings, AppMapping};

const OVERLAY_FULL_W: f64 = 360.0;
const OVERLAY_FULL_H: f64 = 485.0;
const OVERLAY_PILL_W: f64 = 270.0;
const OVERLAY_PILL_H: f64 = 56.0;

#[derive(Debug, Clone)]
struct OverlaySessionState {
    sid: String,
    key_hex: Zeroizing<String>,
    app_name: String,
    domain: String,
    target_hwnd: isize,
    two_step: bool,
    is_manual: bool,
    is_pill: bool,
    scanned: bool,
    last_rect: (i32, i32, i32, i32),
    away_since: Option<Instant>,
}

pub struct AppState {
    config: Mutex<AppConfig>,
    mappings: Mutex<Vec<AppMapping>>,
    active_overlay: Mutex<Option<OverlaySessionState>>,
    active_pairing: Mutex<Option<EphemeralSession>>,
    last_secrets: Mutex<Option<SecretCredentials>>,
    dismissed_hwnds: Mutex<HashMap<isize, Instant>>,
    clipboard_cancel: Mutex<Option<Arc<AtomicBool>>>,
    quitting: AtomicBool,
}

#[derive(Debug, Clone, Serialize)]
pub struct OverlaySessionPayload {
    pub sid: String,
    pub deep_link: String,
    pub app_name: String,
    pub domain: String,
    pub server_url: String,
    pub auth_token: Option<String>,
    pub target_hwnd: isize,
    pub is_pill: bool,
    pub delivery_mode: String,
    pub auto_submit: bool,
    pub language: String,
    pub theme: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct LoginReceivedMeta {
    pub ok: bool,
    pub has_username: bool,
    pub has_password: bool,
    pub has_totp: bool,
    pub masked_username: String,
    pub delivery_mode: String,
    pub can_autotype: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppFullState {
    pub config: AppConfig,
    pub mappings: Vec<AppMapping>,
    pub running_windows: Vec<DetectedWindow>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PairingSessionInfo {
    pub sid: String,
    pub deep_link: String,
    pub server_url: String,
}

fn mask_username(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    let chars: Vec<char> = trimmed.chars().collect();
    if chars.len() <= 2 {
        return "*".repeat(chars.len());
    }
    let visible = 2.min(chars.len() / 2).max(1);
    let prefix: String = chars[..visible].iter().collect();
    format!("{prefix}•••")
}

fn encode_uri_component(input: &str) -> String {
    let mut out = String::with_capacity(input.len() * 2);
    for b in input.as_bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(*b as char);
            }
            _ => {
                out.push_str(&format!("%{:02X}", b));
            }
        }
    }
    out
}

fn build_auth_deep_link(sid: &str, key_hex: &str, domain: &str) -> String {
    format!(
        "flakesecure://auth?s={}&k={}&d={}",
        sid,
        key_hex,
        encode_uri_component(domain)
    )
}

fn build_pair_deep_link(sid: &str, key_hex: &str) -> String {
    format!(
        "flakesecure://pair?s={}&k={}&d=FlakeSecure%20Desktop&action=pair",
        sid, key_hex
    )
}

fn now_unix_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn position_overlay_window(
    overlay_win: &tauri::WebviewWindow,
    target_hwnd: isize,
    target_rect: (i32, i32, i32, i32),
    is_pill: bool,
) {
    let (logical_w, logical_h) = if is_pill {
        (OVERLAY_PILL_W, OVERLAY_PILL_H)
    } else {
        (OVERLAY_FULL_W, OVERLAY_FULL_H)
    };
    let _ = overlay_win.set_size(Size::Logical(LogicalSize::new(logical_w, logical_h)));

    let scale = overlay_win.scale_factor().unwrap_or(1.0);
    let phys_w = (logical_w * scale).round() as i32;
    let phys_h = (logical_h * scale).round() as i32;

    if target_hwnd != 0 && target_rect.2 > 0 && target_rect.3 > 0 {
        let (x, y) = calculate_overlay_position(target_rect, phys_w, phys_h, target_hwnd);
        let _ = overlay_win.set_position(PhysicalPosition::new(x, y));
    } else {
        let _ = overlay_win.center();
    }
}

fn open_overlay_internal(
    app: &AppHandle,
    app_name: String,
    domain: String,
    target_hwnd: isize,
    target_rect: (i32, i32, i32, i32),
    two_step: bool,
    is_manual: bool,
    force_full: bool,
) -> Result<(), String> {
    let state = app.state::<AppState>();
    let cfg = state.config.lock().unwrap().clone();
    let is_pill = !force_full && cfg.overlay_trigger_mode == "compact_pill";

    let eph = generate_ephemeral_session();
    let deep_link = build_auth_deep_link(&eph.sid, &eph.key_hex, &domain);

    let session_state = OverlaySessionState {
        sid: eph.sid.clone(),
        key_hex: Zeroizing::new(eph.key_hex.clone()),
        app_name: app_name.clone(),
        domain: domain.clone(),
        target_hwnd,
        two_step,
        is_manual,
        is_pill,
        scanned: false,
        last_rect: target_rect,
        away_since: None,
    };

    {
        let mut guard = state.active_overlay.lock().unwrap();
        *guard = Some(session_state);
    }

    let payload = OverlaySessionPayload {
        sid: eph.sid,
        deep_link,
        app_name,
        domain,
        server_url: cfg.server_url.clone(),
        auth_token: cfg.paired_user.as_ref().and_then(|u| u.auth_token.clone()),
        target_hwnd,
        is_pill,
        delivery_mode: cfg.delivery_mode.clone(),
        auto_submit: cfg.auto_submit,
        language: cfg.language.clone(),
        theme: cfg.theme.clone(),
    };

    if let Some(overlay_win) = app.get_webview_window("overlay") {
        let _ = security::apply_window_capture_protection(&overlay_win, cfg.anti_capture);
        position_overlay_window(&overlay_win, target_hwnd, target_rect, is_pill);
        let _ = overlay_win.show();
        let _ = overlay_win.emit("overlay-session", payload);
    }
    Ok(())
}

fn hide_overlay_internal(app: &AppHandle, record_dismissal: bool) {
    let state = app.state::<AppState>();
    let hwnd_to_dismiss = {
        let mut guard = state.active_overlay.lock().unwrap();
        let hwnd = guard.as_ref().map(|s| s.target_hwnd).unwrap_or(0);
        *guard = None;
        hwnd
    };
    if record_dismissal && hwnd_to_dismiss != 0 {
        state
            .dismissed_hwnds
            .lock()
            .unwrap()
            .insert(hwnd_to_dismiss, Instant::now());
    }
    if let Some(overlay_win) = app.get_webview_window("overlay") {
        let _ = overlay_win.emit("overlay-reset", ());
        let _ = overlay_win.hide();
    }
}

fn show_menu_window(app: &AppHandle) {
    if let Some(menu_win) = app.get_webview_window("menu") {
        let _ = menu_win.unminimize();
        let _ = menu_win.show();
        let _ = menu_win.set_focus();
    }
}

fn deliver_secrets_in_background(app: AppHandle, mode: String, auto_submit: bool) {
    let state = app.state::<AppState>();
    let (hwnd, two_step, user, pass, totp) = {
        let guard = state.last_secrets.lock().unwrap();
        let Some(ref creds) = *guard else {
            return;
        };
        (
            creds.target_hwnd,
            creds.two_step,
            creds.username.to_string(),
            creds.password.to_string(),
            creds.totp.as_ref().map(|t| t.to_string()),
        )
    };

    if mode == "hybrid_autotype" && hwnd != 0 && is_window_valid(hwnd) {
        let app_clone = app.clone();
        std::thread::spawn(move || {
            let mut u = Zeroizing::new(user);
            let mut p = Zeroizing::new(pass);
            let t = totp.map(Zeroizing::new);
            let res = autofill::perform_hybrid_autofill(
                hwnd,
                &u,
                &p,
                t.as_deref().map(|s| s.as_str()),
                auto_submit,
                two_step,
            );
            zeroize::Zeroize::zeroize(&mut *u);
            zeroize::Zeroize::zeroize(&mut *p);
            match res {
                Ok(_) => {
                    let _ = app_clone.emit(
                        "delivery-status",
                        autofill::DeliveryStatusEvent {
                            stage: "autotype_done".into(),
                            detail: "Credentials injected".into(),
                        },
                    );
                }
                Err(err) => {
                    let _ = app_clone.emit(
                        "delivery-status",
                        autofill::DeliveryStatusEvent {
                            stage: "autotype_error".into(),
                            detail: err,
                        },
                    );
                }
            }
        });
    } else if mode == "smart_clipboard" || (mode == "hybrid_autotype" && (hwnd == 0 || !is_window_valid(hwnd))) {
        let cancel_flag = {
            let mut cguard = state.clipboard_cancel.lock().unwrap();
            if let Some(prev) = cguard.take() {
                prev.store(true, Ordering::SeqCst);
            }
            let next = Arc::new(AtomicBool::new(false));
            *cguard = Some(next.clone());
            next
        };
        let app_clone = app.clone();
        std::thread::spawn(move || {
            autofill::run_smart_sequential_clipboard(app_clone, user, pass, cancel_flag);
        });
    } else {
        // manual_buttons: keep secrets locked in memory for 90s until user picks or timeout fires
        let _ = app.emit(
            "delivery-status",
            autofill::DeliveryStatusEvent {
                stage: "manual_ready".into(),
                detail: "Choose an action below".into(),
            },
        );
    }
}

/* ─── Tauri IPC Commands ────────────────────────────────────────────────── */

#[tauri::command]
fn get_state(state: tauri::State<AppState>) -> AppFullState {
    let config = state.config.lock().unwrap().clone();
    let mappings = state.mappings.lock().unwrap().clone();
    let running_windows = list_visible_windows();
    AppFullState {
        config,
        mappings,
        running_windows,
    }
}

#[tauri::command]
fn list_running_apps() -> Vec<DetectedWindow> {
    list_visible_windows()
}

#[tauri::command]
fn save_app_config(
    app: AppHandle,
    state: tauri::State<AppState>,
    new_config: AppConfig,
) -> Result<AppConfig, String> {
    let old_hotkey = { state.config.lock().unwrap().global_hotkey.clone() };
    save_config(&new_config)?;
    {
        let mut guard = state.config.lock().unwrap();
        *guard = new_config.clone();
    }

    if let Some(overlay_win) = app.get_webview_window("overlay") {
        let _ = security::apply_window_capture_protection(&overlay_win, new_config.anti_capture);
        let _ = overlay_win.emit("config-updated", &new_config);
    }
    if let Some(menu_win) = app.get_webview_window("menu") {
        let _ = menu_win.emit("config-updated", &new_config);
    }

    #[cfg(desktop)]
    if old_hotkey != new_config.global_hotkey {
        use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};
        let _ = app.global_shortcut().unregister_all();
        if let Ok(sc) = new_config.global_hotkey.parse::<Shortcut>() {
            let _ = app.global_shortcut().register(sc);
        }
    }

    Ok(new_config)
}

#[tauri::command]
fn save_mapping(
    app: AppHandle,
    state: tauri::State<AppState>,
    mapping: AppMapping,
) -> Result<Vec<AppMapping>, String> {
    let updated = {
        let mut guard = state.mappings.lock().unwrap();
        if let Some(existing) = guard.iter_mut().find(|m| m.id == mapping.id) {
            *existing = mapping;
        } else {
            guard.push(mapping);
        }
        save_mappings(&guard)?;
        guard.clone()
    };
    let _ = app.emit("mappings-updated", &updated);
    Ok(updated)
}

#[tauri::command]
fn delete_mapping(
    app: AppHandle,
    state: tauri::State<AppState>,
    id: String,
) -> Result<Vec<AppMapping>, String> {
    let updated = {
        let mut guard = state.mappings.lock().unwrap();
        guard.retain(|m| m.id != id);
        save_mappings(&guard)?;
        guard.clone()
    };
    let _ = app.emit("mappings-updated", &updated);
    Ok(updated)
}

#[tauri::command]
fn trigger_overlay_for_app(
    app: AppHandle,
    state: tauri::State<AppState>,
    app_name: String,
    domain: String,
    target_hwnd: Option<isize>,
    two_step: Option<bool>,
) -> Result<(), String> {
    let hwnd = target_hwnd.unwrap_or(0);
    let rect = if hwnd != 0 {
        get_window_rect(hwnd).unwrap_or((0, 0, 0, 0))
    } else {
        (0, 0, 0, 0)
    };

    if hwnd != 0 {
        state.dismissed_hwnds.lock().unwrap().remove(&hwnd);
    }

    open_overlay_internal(
        &app,
        app_name,
        domain,
        hwnd,
        rect,
        two_step.unwrap_or(false),
        true,
        true,
    )
}

#[tauri::command]
fn refresh_overlay_session(app: AppHandle, state: tauri::State<AppState>) -> Result<(), String> {
    let current = { state.active_overlay.lock().unwrap().clone() };
    let Some(sess) = current else {
        return Err("No active overlay session".into());
    };
    open_overlay_internal(
        &app,
        sess.app_name,
        sess.domain,
        sess.target_hwnd,
        sess.last_rect,
        sess.two_step,
        sess.is_manual,
        !sess.is_pill,
    )
}

#[tauri::command]
fn expand_overlay(app: AppHandle, state: tauri::State<AppState>) -> Result<(), String> {
    let (target_hwnd, target_rect) = {
        let mut guard = state.active_overlay.lock().unwrap();
        let Some(ref mut sess) = *guard else {
            return Err("No active overlay".into());
        };
        sess.is_pill = false;
        sess.is_manual = true;
        (sess.target_hwnd, sess.last_rect)
    };

    if let Some(overlay_win) = app.get_webview_window("overlay") {
        position_overlay_window(&overlay_win, target_hwnd, target_rect, false);
        let _ = overlay_win.emit("overlay-expanded", ());
    }
    Ok(())
}

#[tauri::command]
fn dismiss_overlay(app: AppHandle, record_dismissal: Option<bool>) {
    hide_overlay_internal(&app, record_dismissal.unwrap_or(true));
}

#[tauri::command]
fn mark_overlay_scanned(state: tauri::State<AppState>, sid: String) {
    let mut guard = state.active_overlay.lock().unwrap();
    if let Some(ref mut sess) = *guard {
        if sess.sid == sid {
            sess.scanned = true;
        }
    }
}

#[tauri::command]
fn get_overlay_state(state: tauri::State<AppState>) -> Option<OverlaySessionPayload> {
    let cfg = state.config.lock().unwrap().clone();
    let guard = state.active_overlay.lock().unwrap();
    guard.as_ref().map(|sess| OverlaySessionPayload {
        sid: sess.sid.clone(),
        deep_link: build_auth_deep_link(&sess.sid, &sess.key_hex, &sess.domain),
        app_name: sess.app_name.clone(),
        domain: sess.domain.clone(),
        server_url: cfg.server_url.clone(),
        auth_token: cfg.paired_user.as_ref().and_then(|u| u.auth_token.clone()),
        target_hwnd: sess.target_hwnd,
        is_pill: sess.is_pill,
        delivery_mode: cfg.delivery_mode.clone(),
        auto_submit: cfg.auto_submit,
        language: cfg.language.clone(),
        theme: cfg.theme.clone(),
    })
}

#[tauri::command]
fn receive_encrypted_login(
    app: AppHandle,
    state: tauri::State<AppState>,
    sid: String,
    payload: RelayPayload,
) -> Result<LoginReceivedMeta, String> {
    let (key_hex, domain, target_hwnd, two_step) = {
        let guard = state.active_overlay.lock().unwrap();
        let Some(ref sess) = *guard else {
            return Err("No active overlay session".into());
        };
        if sess.sid != sid {
            return Err("Session ID mismatch".into());
        }
        (
            sess.key_hex.clone(),
            sess.domain.clone(),
            sess.target_hwnd,
            sess.two_step,
        )
    };

    let plaintext = decrypt_relay_payload(&payload.iv, &payload.data, &key_hex)?;
    let parsed: DecryptedLoginData = serde_json::from_str(&plaintext)
        .map_err(|e| format!("Invalid decrypted login JSON: {e}"))?;

    let username = parsed.username.unwrap_or_default();
    let password = parsed.password.unwrap_or_default();
    let totp = parsed.totp.or(parsed.code);

    let has_username = !username.is_empty();
    let has_password = !password.is_empty();
    let has_totp = totp.as_ref().map(|c| !c.is_empty()).unwrap_or(false);
    let masked = mask_username(&username);

    let cfg = state.config.lock().unwrap().clone();
    let creds = SecretCredentials::new(username, password, totp, domain, target_hwnd, two_step);

    {
        let mut sguard = state.last_secrets.lock().unwrap();
        *sguard = Some(creds);
    }

    // Schedule automatic zeroize wipe after 120s so secrets never linger in memory
    let app_wipe = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(120));
        let st = app_wipe.state::<AppState>();
        let mut sguard = st.last_secrets.lock().unwrap();
        *sguard = None;
    });

    if cfg.delivery_mode != "manual_buttons" {
        deliver_secrets_in_background(app.clone(), cfg.delivery_mode.clone(), cfg.auto_submit);
    }

    Ok(LoginReceivedMeta {
        ok: true,
        has_username,
        has_password,
        has_totp,
        masked_username: masked,
        delivery_mode: cfg.delivery_mode,
        can_autotype: target_hwnd != 0 && is_window_valid(target_hwnd),
    })
}

#[tauri::command]
fn receive_encrypted_totp(
    app: AppHandle,
    state: tauri::State<AppState>,
    sid: String,
    payload: RelayPayload,
) -> Result<bool, String> {
    let (key_hex, target_hwnd) = {
        let guard = state.active_overlay.lock().unwrap();
        let Some(ref sess) = *guard else {
            return Err("No active overlay session".into());
        };
        if sess.sid != sid {
            return Err("Session ID mismatch".into());
        }
        (sess.key_hex.clone(), sess.target_hwnd)
    };

    let plaintext = decrypt_relay_payload(&payload.iv, &payload.data, &key_hex)?;
    let parsed: DecryptedLoginData = serde_json::from_str(&plaintext)
        .map_err(|e| format!("Invalid decrypted TOTP JSON: {e}"))?;

    let code = parsed
        .code
        .or(parsed.totp)
        .ok_or_else(|| "Missing TOTP code in payload".to_string())?;

    let cfg = state.config.lock().unwrap().clone();

    if cfg.delivery_mode == "hybrid_autotype" && target_hwnd != 0 && is_window_valid(target_hwnd) {
        let app_c = app.clone();
        std::thread::spawn(move || {
            let mut c = Zeroizing::new(code);
            autofill::perform_totp_autofill(target_hwnd, &c, cfg.auto_submit);
            zeroize::Zeroize::zeroize(&mut *c);
            let _ = app_c.emit(
                "delivery-status",
                autofill::DeliveryStatusEvent {
                    stage: "totp_injected".into(),
                    detail: "2FA code injected".into(),
                },
            );
        });
    } else {
        autofill::copy_single_with_auto_clear(app.clone(), code, "totp", 45);
    }

    Ok(true)
}

#[tauri::command]
fn trigger_manual_autotype(app: AppHandle, state: tauri::State<AppState>) -> Result<(), String> {
    let cfg = state.config.lock().unwrap().clone();
    deliver_secrets_in_background(app, "hybrid_autotype".to_string(), cfg.auto_submit);
    Ok(())
}

#[tauri::command]
fn copy_secret_field(
    app: AppHandle,
    state: tauri::State<AppState>,
    field: String,
) -> Result<(), String> {
    let val = {
        let guard = state.last_secrets.lock().unwrap();
        let Some(ref creds) = *guard else {
            return Err("No decrypted credentials available".into());
        };
        match field.as_str() {
            "username" => creds.username.to_string(),
            "password" => creds.password.to_string(),
            "totp" => creds
                .totp
                .as_ref()
                .map(|t| t.to_string())
                .ok_or_else(|| "No TOTP code available".to_string())?,
            _ => return Err("Unknown credential field".into()),
        }
    };

    let field_label: &'static str = match field.as_str() {
        "username" => "username",
        "password" => "password",
        _ => "totp",
    };
    autofill::copy_single_with_auto_clear(app, val, field_label, 35);
    Ok(())
}

#[tauri::command]
fn start_pairing_session(state: tauri::State<AppState>) -> PairingSessionInfo {
    let eph = generate_ephemeral_session();
    let cfg = state.config.lock().unwrap().clone();
    let deep_link = build_pair_deep_link(&eph.sid, &eph.key_hex);
    let sid = eph.sid.clone();
    *state.active_pairing.lock().unwrap() = Some(eph);

    PairingSessionInfo {
        sid,
        deep_link,
        server_url: cfg.server_url,
    }
}

#[tauri::command]
fn stop_pairing_session(state: tauri::State<AppState>) {
    *state.active_pairing.lock().unwrap() = None;
}

#[tauri::command]
fn receive_encrypted_pairing(
    app: AppHandle,
    state: tauri::State<AppState>,
    sid: String,
    payload: RelayPayload,
) -> Result<PairedUser, String> {
    let key_hex = {
        let guard = state.active_pairing.lock().unwrap();
        let Some(ref sess) = *guard else {
            return Err("No active pairing session".into());
        };
        if sess.sid != sid {
            return Err("Pairing session ID mismatch".into());
        }
        sess.key_hex.clone()
    };

    let plaintext = decrypt_relay_payload(&payload.iv, &payload.data, &key_hex)?;
    let parsed: DecryptedPairingData = serde_json::from_str(&plaintext)
        .map_err(|e| format!("Invalid pairing JSON: {e}"))?;

    let token = parsed.token.or(parsed.auth_token);
    let user_val = parsed
        .user
        .or(parsed.auth_user)
        .ok_or_else(|| "Missing user object in pairing data".to_string())?;

    let username = user_val
        .get("username")
        .and_then(|v| v.as_str())
        .or_else(|| user_val.get("email").and_then(|v| v.as_str()))
        .unwrap_or("FlakeSecure User")
        .to_string();
    let email = user_val
        .get("email")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let paired = PairedUser {
        username,
        email,
        auth_token: token,
    };

    {
        let mut cguard = state.config.lock().unwrap();
        cguard.paired_user = Some(paired.clone());
        save_config(&cguard)?;
    }
    *state.active_pairing.lock().unwrap() = None;
    let _ = app.emit("pairing-updated", &paired);
    Ok(paired)
}

#[tauri::command]
fn set_paired_account(
    app: AppHandle,
    state: tauri::State<AppState>,
    user: Option<PairedUser>,
) -> Result<(), String> {
    {
        let mut cguard = state.config.lock().unwrap();
        cguard.paired_user = user.clone();
        save_config(&cguard)?;
    }
    let _ = app.emit("pairing-updated", &user);
    Ok(())
}

#[tauri::command]
fn clear_secret_cache(state: tauri::State<AppState>) {
    *state.last_secrets.lock().unwrap() = None;
    if let Some(flag) = state.clipboard_cancel.lock().unwrap().take() {
        flag.store(true, Ordering::SeqCst);
    }
    autofill::clear_clipboard_if_sequence(None);
}

#[tauri::command]
fn open_menu_window(app: AppHandle) {
    show_menu_window(&app);
}

fn trigger_active_window_hotkey(app: &AppHandle) {
    let Some(fg) = get_foreground_window() else {
        show_menu_window(app);
        return;
    };
    let state = app.state::<AppState>();
    let mappings = state.mappings.lock().unwrap().clone();
    if let Some(m) = find_matching_mapping(&mappings, &fg.exe_name, &fg.title, fg.width, fg.height) {
        let _ = open_overlay_internal(
            app,
            m.app_name.clone(),
            m.domain.clone(),
            fg.hwnd,
            (fg.x, fg.y, fg.width, fg.height),
            m.two_step_login,
            true,
            true,
        );
    } else if let Some(by_exe) = mappings.iter().find(|m| m.matches_exe(&fg.exe_name)) {
        let _ = open_overlay_internal(
            app,
            by_exe.app_name.clone(),
            by_exe.domain.clone(),
            fg.hwnd,
            (fg.x, fg.y, fg.width, fg.height),
            by_exe.two_step_login,
            true,
            true,
        );
    } else {
        show_menu_window(app);
        let _ = app.emit("hotkey-unmapped-window", fg);
    }
}

fn spawn_detector_loop(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut tick_count: u64 = 0;
        loop {
            tokio::time::sleep(Duration::from_millis(350)).await;
            tick_count = tick_count.wrapping_add(1);

            let state = app.state::<AppState>();

            // Periodic cleanup of expired hwnd dismissals (120s cooldown)
            if tick_count % 30 == 0 {
                let mut dguard = state.dismissed_hwnds.lock().unwrap();
                dguard.retain(|_, ts| ts.elapsed() < Duration::from_secs(120));
            }

            let cfg = state.config.lock().unwrap().clone();
            let active_sess = state.active_overlay.lock().unwrap().clone();

            // 1. Reposition / lifecycle maintenance for an active overlay
            if let Some(sess) = active_sess {
                if sess.target_hwnd != 0 {
                    if !is_window_valid(sess.target_hwnd) {
                        hide_overlay_internal(&app, false);
                        continue;
                    }

                    if let Some(rect) = get_window_rect(sess.target_hwnd) {
                        if rect != sess.last_rect {
                            if let Some(overlay_win) = app.get_webview_window("overlay") {
                                position_overlay_window(
                                    &overlay_win,
                                    sess.target_hwnd,
                                    rect,
                                    sess.is_pill,
                                );
                            }
                            let mut oguard = state.active_overlay.lock().unwrap();
                            if let Some(ref mut s) = *oguard {
                                if s.sid == sess.sid {
                                    s.last_rect = rect;
                                }
                            }
                        }
                    }

                    // Auto-triggered overlay hides gracefully if user switches to a completely unrelated window
                    if !sess.is_manual && !sess.scanned {
                        let fg_hwnd = get_foreground_window().map(|w| w.hwnd).unwrap_or(0);
                        let still_same_or_ours =
                            fg_hwnd == sess.target_hwnd || is_own_foreground() || fg_hwnd == 0;
                        let mut oguard = state.active_overlay.lock().unwrap();
                        if let Some(ref mut s) = *oguard {
                            if s.sid == sess.sid {
                                if still_same_or_ours {
                                    s.away_since = None;
                                } else {
                                    let away = s.away_since.get_or_insert_with(Instant::now);
                                    if away.elapsed() >= Duration::from_millis(1400) {
                                        drop(oguard);
                                        hide_overlay_internal(&app, false);
                                    }
                                }
                            }
                        }
                    }
                }
                continue;
            }

            // 2. Auto-detect login windows in foreground
            if !cfg.auto_detect_enabled || cfg.overlay_trigger_mode == "manual_only" {
                continue;
            }

            let Some(fg) = get_foreground_window() else {
                continue;
            };

            let dismissed = state
                .dismissed_hwnds
                .lock()
                .unwrap()
                .get(&fg.hwnd)
                .map(|t| t.elapsed() < Duration::from_secs(120))
                .unwrap_or(false);
            if dismissed {
                continue;
            }

            let mappings = state.mappings.lock().unwrap().clone();
            if let Some(mapping) =
                find_matching_mapping(&mappings, &fg.exe_name, &fg.title, fg.width, fg.height)
            {
                let _ = open_overlay_internal(
                    &app,
                    mapping.app_name.clone(),
                    mapping.domain.clone(),
                    fg.hwnd,
                    (fg.x, fg.y, fg.width, fg.height),
                    mapping.two_step_login,
                    false,
                    false,
                );
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let initial_config = load_config();
    let initial_mappings = load_mappings();
    let start_minimized = std::env::args().any(|a| a == "--minimized" || a == "--tray");

    let builder = tauri::Builder::default().manage(AppState {
        config: Mutex::new(initial_config.clone()),
        mappings: Mutex::new(initial_mappings),
        active_overlay: Mutex::new(None),
        active_pairing: Mutex::new(None),
        last_secrets: Mutex::new(None),
        dismissed_hwnds: Mutex::new(HashMap::new()),
        clipboard_cancel: Mutex::new(None),
        quitting: AtomicBool::new(false),
    });

    #[cfg(desktop)]
    let builder = builder.plugin(
        tauri_plugin_global_shortcut::Builder::new()
            .with_handler(|app, _shortcut, event| {
                use tauri_plugin_global_shortcut::ShortcutState;
                if event.state() == ShortcutState::Pressed {
                    trigger_active_window_hotkey(app);
                }
            })
            .build(),
    );

    let app = builder
        .setup(move |app| {
            let handle = app.handle().clone();

            if let Some(menu_win) = app.get_webview_window("menu") {
                if start_minimized {
                    let _ = menu_win.hide();
                } else {
                    let _ = menu_win.show();
                }
            }

            if let Some(overlay_win) = app.get_webview_window("overlay") {
                let _ = security::apply_window_capture_protection(
                    &overlay_win,
                    initial_config.anti_capture,
                );
            }

            // Setup System Tray
            let open_item =
                MenuItem::with_id(app, "open_menu", "FlakeSecure Menü öffnen", true, None::<&str>)?;
            let quick_item = MenuItem::with_id(
                app,
                "quick_active",
                "QR-Overlay für aktives Fenster",
                true,
                None::<&str>,
            )?;
            let auto_item = CheckMenuItem::with_id(
                app,
                "toggle_autodetect",
                "Auto-Erkennung aktiv",
                true,
                initial_config.auto_detect_enabled,
                None::<&str>,
            )?;
            let sep = PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItem::with_id(app, "quit", "Beenden", true, None::<&str>)?;

            let tray_menu =
                Menu::with_items(app, &[&open_item, &quick_item, &auto_item, &sep, &quit_item])?;

            let auto_item_clone = auto_item.clone();
            let mut tray_builder = TrayIconBuilder::with_id("main-tray")
                .menu(&tray_menu)
                .tooltip("FlakeSecure Desktop Login")
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "open_menu" => {
                        show_menu_window(app);
                    }
                    "quick_active" => {
                        trigger_active_window_hotkey(app);
                    }
                    "toggle_autodetect" => {
                        let st = app.state::<AppState>();
                        let mut cguard = st.config.lock().unwrap();
                        cguard.auto_detect_enabled = !cguard.auto_detect_enabled;
                        let enabled = cguard.auto_detect_enabled;
                        let _ = save_config(&cguard);
                        let _ = auto_item_clone.set_checked(enabled);
                        let _ = app.emit("config-updated", &*cguard);
                    }
                    "quit" => {
                        let st = app.state::<AppState>();
                        st.quitting.store(true, Ordering::SeqCst);
                        *st.last_secrets.lock().unwrap() = None;
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_menu_window(tray.app_handle());
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }
            let _tray = tray_builder.build(app)?;

            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};
                if let Ok(sc) = initial_config.global_hotkey.parse::<Shortcut>() {
                    let _ = app.global_shortcut().register(sc);
                }
            }

            let _ = now_unix_secs();
            let _ = get_window_by_hwnd(0);
            spawn_detector_loop(handle);
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let st = window.app_handle().state::<AppState>();
                if !st.quitting.load(Ordering::SeqCst) {
                    api.prevent_close();
                    if window.label() == "overlay" {
                        hide_overlay_internal(window.app_handle(), true);
                    } else {
                        let _ = window.hide();
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_state,
            list_running_apps,
            save_app_config,
            save_mapping,
            delete_mapping,
            trigger_overlay_for_app,
            refresh_overlay_session,
            expand_overlay,
            dismiss_overlay,
            mark_overlay_scanned,
            get_overlay_state,
            receive_encrypted_login,
            receive_encrypted_totp,
            trigger_manual_autotype,
            copy_secret_field,
            start_pairing_session,
            stop_pairing_session,
            receive_encrypted_pairing,
            set_paired_account,
            clear_secret_cache,
            open_menu_window,
        ])
        .build(tauri::generate_context!())
        .expect("error while building FlakeSecure Desktop Login");

    app.run(|app_handle, event| {
        if let RunEvent::ExitRequested { api, .. } = event {
            let st = app_handle.state::<AppState>();
            if !st.quitting.load(Ordering::SeqCst) {
                api.prevent_exit();
            }
        }
    });
}
