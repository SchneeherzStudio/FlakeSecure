use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PairedUser {
    pub username: String,
    pub email: Option<String>,
    pub auth_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AppConfig {
    pub server_url: String,
    pub auto_detect_enabled: bool,
    /// "auto_overlay" | "compact_pill" | "manual_only"
    pub overlay_trigger_mode: String,
    /// "hybrid_autotype" | "smart_clipboard" | "manual_buttons"
    pub delivery_mode: String,
    pub auto_submit: bool,
    pub anti_capture: bool,
    pub global_hotkey: String,
    /// "de" | "en" | "fr" | "es"
    pub language: String,
    /// "dark" | "light"
    pub theme: String,
    pub paired_user: Option<PairedUser>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            server_url: "https://flakesecure.snowystudio.dev".to_string(),
            auto_detect_enabled: true,
            overlay_trigger_mode: "auto_overlay".to_string(),
            delivery_mode: "hybrid_autotype".to_string(),
            auto_submit: true,
            anti_capture: true,
            global_hotkey: "Alt+Shift+F".to_string(),
            language: "de".to_string(),
            theme: "dark".to_string(),
            paired_user: None,
        }
    }
}

pub fn app_config_dir() -> PathBuf {
    let base = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    base.join("FlakeSecure").join("desktop-login")
}

fn config_file_path() -> PathBuf {
    app_config_dir().join("config.json")
}

pub fn load_config() -> AppConfig {
    let path = config_file_path();
    match fs::read_to_string(&path) {
        Ok(raw) => serde_json::from_str::<AppConfig>(&raw).unwrap_or_default(),
        Err(_) => AppConfig::default(),
    }
}

pub fn save_config(cfg: &AppConfig) -> Result<(), String> {
    let dir = app_config_dir();
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create config dir: {e}"))?;
    let json = serde_json::to_string_pretty(cfg)
        .map_err(|e| format!("Failed to serialize config: {e}"))?;
    fs::write(config_file_path(), json).map_err(|e| format!("Failed to write config: {e}"))?;
    Ok(())
}
