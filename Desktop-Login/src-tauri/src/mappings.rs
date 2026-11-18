use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

use crate::config::app_config_dir;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AppMapping {
    pub id: String,
    pub app_name: String,
    pub executables: Vec<String>,
    pub domain: String,
    pub login_title_keywords: Vec<String>,
    pub exclude_title_keywords: Vec<String>,
    pub max_login_width: Option<i32>,
    pub max_login_height: Option<i32>,
    pub two_step_login: bool,
    pub enabled: bool,
    pub is_custom: bool,
}

impl Default for AppMapping {
    fn default() -> Self {
        Self {
            id: String::new(),
            app_name: String::new(),
            executables: Vec::new(),
            domain: String::new(),
            login_title_keywords: Vec::new(),
            exclude_title_keywords: Vec::new(),
            max_login_width: None,
            max_login_height: None,
            two_step_login: false,
            enabled: true,
            is_custom: false,
        }
    }
}

impl AppMapping {
    pub fn matches_exe(&self, exe_name: &str) -> bool {
        let target = exe_name.trim().to_ascii_lowercase();
        if target.is_empty() {
            return false;
        }
        self.executables
            .iter()
            .any(|e| e.trim().to_ascii_lowercase() == target)
    }

    /// Evaluates whether a window belongs to a login screen of this mapping.
    pub fn matches_window(&self, exe_name: &str, title: &str, width: i32, height: i32) -> bool {
        if !self.enabled || !self.matches_exe(exe_name) {
            return false;
        }
        if let Some(max_w) = self.max_login_width {
            if width > max_w {
                return false;
            }
        }
        if let Some(max_h) = self.max_login_height {
            if height > max_h {
                return false;
            }
        }

        let title_lower = title.trim().to_ascii_lowercase();
        if title_lower.is_empty() {
            return false;
        }

        for ex in &self.exclude_title_keywords {
            let ex_lower = ex.trim().to_ascii_lowercase();
            if !ex_lower.is_empty() && title_lower.contains(&ex_lower) {
                return false;
            }
        }

        if self.login_title_keywords.is_empty() {
            return true;
        }

        self.login_title_keywords.iter().any(|kw| {
            let kw_lower = kw.trim().to_ascii_lowercase();
            !kw_lower.is_empty() && title_lower.contains(&kw_lower)
        })
    }
}

pub fn default_mappings() -> Vec<AppMapping> {
    vec![
        AppMapping {
            id: "riot-client".into(),
            app_name: "Riot Client".into(),
            executables: vec![
                "RiotClientServices.exe".into(),
                "Riot Client.exe".into(),
                "RiotClientUx.exe".into(),
            ],
            domain: "authenticate.riotgames.com".into(),
            login_title_keywords: vec!["riot client".into(), "sign in".into(), "anmelden".into()],
            exclude_title_keywords: vec!["settings".into(), "einstellungen".into()],
            max_login_width: None,
            max_login_height: None,
            two_step_login: false,
            enabled: true,
            is_custom: false,
        },
        AppMapping {
            id: "steam".into(),
            app_name: "Steam".into(),
            executables: vec!["steam.exe".into(), "steamwebhelper.exe".into()],
            domain: "store.steampowered.com".into(),
            login_title_keywords: vec![
                "sign in to steam".into(),
                "bei steam anmelden".into(),
                "steam login".into(),
                "steam-anmeldung".into(),
                "steam sign in".into(),
            ],
            exclude_title_keywords: vec![
                "library".into(),
                "bibliothek".into(),
                "big picture".into(),
                "friends".into(),
                "freundesliste".into(),
            ],
            max_login_width: Some(920),
            max_login_height: Some(760),
            two_step_login: false,
            enabled: true,
            is_custom: false,
        },
        AppMapping {
            id: "discord".into(),
            app_name: "Discord".into(),
            executables: vec![
                "Discord.exe".into(),
                "DiscordPTB.exe".into(),
                "DiscordCanary.exe".into(),
            ],
            domain: "discord.com".into(),
            login_title_keywords: vec!["discord".into(), "log in".into(), "anmelden".into()],
            exclude_title_keywords: vec![
                "#".into(),
                "friends -".into(),
                "freunde -".into(),
                "direct messages".into(),
                "direktnachrichten".into(),
                "voice connected".into(),
            ],
            max_login_width: Some(1350),
            max_login_height: None,
            two_step_login: false,
            enabled: true,
            is_custom: false,
        },
        AppMapping {
            id: "battlenet".into(),
            app_name: "Battle.net".into(),
            executables: vec!["Battle.net.exe".into()],
            domain: "account.battle.net".into(),
            login_title_keywords: vec![
                "battle.net login".into(),
                "battle.net-anmeldung".into(),
                "battle.net".into(),
            ],
            exclude_title_keywords: vec!["shop".into(), "games".into(), "spiele".into()],
            max_login_width: Some(540),
            max_login_height: Some(820),
            two_step_login: false,
            enabled: true,
            is_custom: false,
        },
        AppMapping {
            id: "epic-games".into(),
            app_name: "Epic Games Launcher".into(),
            executables: vec!["EpicGamesLauncher.exe".into()],
            domain: "epicgames.com".into(),
            login_title_keywords: vec![
                "sign in".into(),
                "anmelden".into(),
                "epic games launcher".into(),
                "epic games".into(),
            ],
            exclude_title_keywords: vec![
                "store".into(),
                "library".into(),
                "bibliothek".into(),
                "unreal engine".into(),
            ],
            max_login_width: Some(680),
            max_login_height: Some(860),
            two_step_login: true,
            enabled: true,
            is_custom: false,
        },
        AppMapping {
            id: "spotify".into(),
            app_name: "Spotify".into(),
            executables: vec!["Spotify.exe".into()],
            domain: "accounts.spotify.com".into(),
            login_title_keywords: vec!["spotify".into(), "log in".into(), "anmelden".into()],
            exclude_title_keywords: vec![
                "spotify free".into(),
                "spotify premium".into(),
                " - ".into(),
            ],
            max_login_width: None,
            max_login_height: None,
            two_step_login: false,
            enabled: true,
            is_custom: false,
        },
        AppMapping {
            id: "ubisoft-connect".into(),
            app_name: "Ubisoft Connect".into(),
            executables: vec!["upc.exe".into(), "UbisoftConnect.exe".into()],
            domain: "ubisoft.com".into(),
            login_title_keywords: vec![
                "ubisoft connect".into(),
                "log in".into(),
                "anmelden".into(),
            ],
            exclude_title_keywords: vec!["games".into(), "spiele".into(), "store".into()],
            max_login_width: Some(640),
            max_login_height: None,
            two_step_login: false,
            enabled: true,
            is_custom: false,
        },
        AppMapping {
            id: "ea-app".into(),
            app_name: "EA App".into(),
            executables: vec!["EADesktop.exe".into(), "EALauncher.exe".into()],
            domain: "ea.com".into(),
            login_title_keywords: vec!["ea app".into(), "sign in".into(), "anmelden".into()],
            exclude_title_keywords: vec!["library".into(), "bibliothek".into(), "browse".into()],
            max_login_width: Some(640),
            max_login_height: None,
            two_step_login: true,
            enabled: true,
            is_custom: false,
        },
        AppMapping {
            id: "minecraft".into(),
            app_name: "Minecraft Launcher".into(),
            executables: vec!["MinecraftLauncher.exe".into(), "Minecraft.exe".into()],
            domain: "minecraft.net".into(),
            login_title_keywords: vec![
                "minecraft launcher".into(),
                "sign in".into(),
                "anmelden".into(),
            ],
            exclude_title_keywords: vec!["java edition".into(), "bedrock".into()],
            max_login_width: Some(820),
            max_login_height: None,
            two_step_login: true,
            enabled: true,
            is_custom: false,
        },
        AppMapping {
            id: "gog-galaxy".into(),
            app_name: "GOG Galaxy".into(),
            executables: vec!["GalaxyClient.exe".into()],
            domain: "gog.com".into(),
            login_title_keywords: vec![
                "gog galaxy".into(),
                "log in".into(),
                "sign in".into(),
                "anmelden".into(),
            ],
            exclude_title_keywords: vec!["installed".into(), "installiert".into(), "recent".into()],
            max_login_width: Some(640),
            max_login_height: None,
            two_step_login: false,
            enabled: true,
            is_custom: false,
        },
        AppMapping {
            id: "github-desktop".into(),
            app_name: "GitHub Desktop".into(),
            executables: vec!["GitHubDesktop.exe".into()],
            domain: "github.com".into(),
            login_title_keywords: vec![
                "sign in".into(),
                "anmelden".into(),
                "github desktop".into(),
            ],
            exclude_title_keywords: vec!["repository".into(), "changes".into()],
            max_login_width: None,
            max_login_height: None,
            two_step_login: false,
            enabled: true,
            is_custom: false,
        },
        AppMapping {
            id: "slack".into(),
            app_name: "Slack".into(),
            executables: vec!["Slack.exe".into()],
            domain: "slack.com".into(),
            login_title_keywords: vec!["sign in".into(), "anmelden".into(), "slack".into()],
            exclude_title_keywords: vec!["| slack".into()],
            max_login_width: None,
            max_login_height: None,
            two_step_login: false,
            enabled: true,
            is_custom: false,
        },
        AppMapping {
            id: "zoom".into(),
            app_name: "Zoom".into(),
            executables: vec!["Zoom.exe".into()],
            domain: "zoom.us".into(),
            login_title_keywords: vec!["sign in".into(), "anmelden".into(), "zoom".into()],
            exclude_title_keywords: vec!["zoom meeting".into(), "zoom workplace".into()],
            max_login_width: Some(650),
            max_login_height: None,
            two_step_login: false,
            enabled: true,
            is_custom: false,
        },
        AppMapping {
            id: "telegram".into(),
            app_name: "Telegram Desktop".into(),
            executables: vec!["Telegram.exe".into()],
            domain: "telegram.org".into(),
            login_title_keywords: vec!["telegram".into()],
            exclude_title_keywords: vec!["(".into(), "saved messages".into(), "gespeicherte".into()],
            max_login_width: Some(960),
            max_login_height: None,
            two_step_login: false,
            enabled: true,
            is_custom: false,
        },
    ]
}

fn mappings_file_path() -> PathBuf {
    app_config_dir().join("mappings.json")
}

pub fn load_mappings() -> Vec<AppMapping> {
    let path = mappings_file_path();
    let defaults = default_mappings();
    let Ok(raw) = fs::read_to_string(&path) else {
        return defaults;
    };
    let Ok(saved) = serde_json::from_str::<Vec<AppMapping>>(&raw) else {
        return defaults;
    };
    if saved.is_empty() {
        return defaults;
    }

    let mut merged = saved;
    for def in defaults {
        if !merged.iter().any(|m| m.id == def.id) {
            merged.push(def);
        }
    }
    merged
}

pub fn save_mappings(mappings: &[AppMapping]) -> Result<(), String> {
    let dir = app_config_dir();
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create config dir: {e}"))?;
    let json = serde_json::to_string_pretty(mappings)
        .map_err(|e| format!("Failed to serialize mappings: {e}"))?;
    fs::write(mappings_file_path(), json).map_err(|e| format!("Failed to write mappings: {e}"))?;
    Ok(())
}

pub fn find_matching_mapping<'a>(
    mappings: &'a [AppMapping],
    exe_name: &str,
    title: &str,
    width: i32,
    height: i32,
) -> Option<&'a AppMapping> {
    mappings
        .iter()
        .find(|m| m.matches_window(exe_name, title, width, height))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_steam_login_vs_main_window() {
        let mappings = default_mappings();
        let login = find_matching_mapping(&mappings, "steam.exe", "Sign in to Steam", 700, 480);
        assert!(login.is_some());
        assert_eq!(login.unwrap().domain, "store.steampowered.com");

        let login_de = find_matching_mapping(&mappings, "steamwebhelper.exe", "Bei Steam anmelden", 700, 480);
        assert!(login_de.is_some());

        let main_win = find_matching_mapping(&mappings, "steam.exe", "Steam", 1280, 800);
        assert!(main_win.is_none());
    }

    #[test]
    fn test_riot_client_detection() {
        let mappings = default_mappings();
        let found = find_matching_mapping(&mappings, "RiotClientServices.exe", "Riot Client", 1024, 640);
        assert!(found.is_some());
        assert_eq!(found.unwrap().domain, "authenticate.riotgames.com");
    }

    #[test]
    fn test_battlenet_size_filter() {
        let mappings = default_mappings();
        let login = find_matching_mapping(&mappings, "Battle.net.exe", "Battle.net Login", 420, 620);
        assert!(login.is_some());
        assert_eq!(login.unwrap().domain, "account.battle.net");

        let main_client = find_matching_mapping(&mappings, "Battle.net.exe", "Battle.net", 1280, 850);
        assert!(main_client.is_none());
    }

    #[test]
    fn test_discord_login_vs_chat() {
        let mappings = default_mappings();
        let login = find_matching_mapping(&mappings, "Discord.exe", "Discord", 1100, 720);
        assert!(login.is_some());
        assert_eq!(login.unwrap().domain, "discord.com");

        let chat = find_matching_mapping(&mappings, "Discord.exe", "#general - Discord", 1200, 720);
        assert!(chat.is_none());
    }
}
