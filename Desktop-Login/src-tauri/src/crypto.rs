use aes::Aes256;
use cipher::{KeyIvInit, StreamCipher};
use ctr::Ctr64BE;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;
use zeroize::Zeroizing;

use crate::security::{lock_secret_slice, unlock_secret_slice};

type Aes256Ctr64BE = Ctr64BE<Aes256>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EphemeralSession {
    pub sid: String,
    pub key_hex: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RelayPayload {
    pub iv: Vec<u8>,
    pub data: Vec<u8>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DecryptedLoginData {
    pub username: Option<String>,
    pub password: Option<String>,
    pub totp: Option<String>,
    pub code: Option<String>,
    #[allow(dead_code)]
    pub action: Option<String>,
    #[allow(dead_code)]
    pub domain: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DecryptedPairingData {
    pub token: Option<String>,
    #[serde(rename = "authToken")]
    pub auth_token: Option<String>,
    pub user: Option<serde_json::Value>,
    #[serde(rename = "authUser")]
    pub auth_user: Option<serde_json::Value>,
}

/// Holds decrypted credentials in locked, zeroized memory inside the Rust daemon.
pub struct SecretCredentials {
    pub username: Zeroizing<String>,
    pub password: Zeroizing<String>,
    pub totp: Option<Zeroizing<String>>,
    #[allow(dead_code)]
    pub domain: String,
    pub target_hwnd: isize,
    pub two_step: bool,
}

impl SecretCredentials {
    pub fn new(
        username: String,
        password: String,
        totp: Option<String>,
        domain: String,
        target_hwnd: isize,
        two_step: bool,
    ) -> Self {
        let u = Zeroizing::new(username);
        let p = Zeroizing::new(password);
        let t = totp.map(Zeroizing::new);
        lock_secret_slice(u.as_bytes());
        lock_secret_slice(p.as_bytes());
        if let Some(ref code) = t {
            lock_secret_slice(code.as_bytes());
        }
        Self {
            username: u,
            password: p,
            totp: t,
            domain,
            target_hwnd,
            two_step,
        }
    }
}

impl Drop for SecretCredentials {
    fn drop(&mut self) {
        unlock_secret_slice(self.username.as_bytes());
        unlock_secret_slice(self.password.as_bytes());
        if let Some(ref code) = self.totp {
            unlock_secret_slice(code.as_bytes());
        }
    }
}

/// Generates a cryptographically secure 16-byte session ID and 32-byte AES-256 key.
pub fn generate_ephemeral_session() -> EphemeralSession {
    let mut sid_bytes = [0u8; 16];
    let mut key_bytes = [0u8; 32];
    let mut rng = rand::rngs::OsRng;
    rng.fill_bytes(&mut sid_bytes);
    rng.fill_bytes(&mut key_bytes);

    let session = EphemeralSession {
        sid: hex::encode(sid_bytes),
        key_hex: hex::encode(key_bytes),
    };
    zeroize::Zeroize::zeroize(&mut key_bytes);
    session
}

/// Verifies the SHA-256 MAC over `hex(iv) + hex(ciphertext)` in constant time and
/// decrypts the AES-256-CTR (64-bit big-endian counter) payload matching the FlakeSecure relay protocol.
pub fn decrypt_relay_payload(
    iv: &[u8],
    data: &[u8],
    key_hex: &str,
) -> Result<Zeroizing<String>, String> {
    const TAG_LEN: usize = 32;
    if iv.len() != 16 {
        return Err(format!("Invalid IV length: expected 16, got {}", iv.len()));
    }
    if data.len() <= TAG_LEN {
        return Err("Encrypted payload too short".to_string());
    }

    let key_bytes = Zeroizing::new(
        hex::decode(key_hex.trim()).map_err(|_| "Invalid hex AES key".to_string())?,
    );
    if key_bytes.len() != 32 {
        return Err(format!(
            "Invalid AES key length: expected 32 bytes, got {}",
            key_bytes.len()
        ));
    }

    let split_at = data.len() - TAG_LEN;
    let ciphertext = &data[..split_at];
    let tag_bytes = &data[split_at..];

    let mac_input_hex = format!("{}{}", hex::encode(iv), hex::encode(ciphertext));
    let expected_tag = Sha256::digest(mac_input_hex.as_bytes());

    if expected_tag.as_slice().ct_eq(tag_bytes).unwrap_u8() != 1 {
        return Err("MAC verification failed — payload may be tampered".to_string());
    }

    let mut buffer = Zeroizing::new(ciphertext.to_vec());
    let mut cipher = Aes256Ctr64BE::new_from_slices(key_bytes.as_slice(), iv)
        .map_err(|e| format!("Cipher init failed: {e}"))?;
    cipher.apply_keystream(&mut buffer);
    drop(key_bytes);

    let plaintext = String::from_utf8(buffer.to_vec())
        .map_err(|_| "Decrypted payload is not valid UTF-8".to_string())?;
    Ok(Zeroizing::new(plaintext))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn encrypt_like_mobile(plaintext: &str, key_hex: &str, iv: &[u8; 16]) -> RelayPayload {
        let key_bytes = hex::decode(key_hex).unwrap();
        let mut ciphertext = plaintext.as_bytes().to_vec();
        let mut cipher = Aes256Ctr64BE::new_from_slices(&key_bytes, iv).unwrap();
        cipher.apply_keystream(&mut ciphertext);

        let mac_input = format!("{}{}", hex::encode(iv), hex::encode(&ciphertext));
        let tag = Sha256::digest(mac_input.as_bytes());

        let mut data = ciphertext;
        data.extend_from_slice(&tag);
        RelayPayload {
            iv: iv.to_vec(),
            data,
        }
    }

    #[test]
    fn test_session_generation_format() {
        let sess = generate_ephemeral_session();
        assert_eq!(sess.sid.len(), 32);
        assert_eq!(sess.key_hex.len(), 64);
        assert!(sess.sid.chars().all(|c| c.is_ascii_hexdigit()));
        assert!(sess.key_hex.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn test_aes256_ctr_sha256_mac_roundtrip() {
        let sess = generate_ephemeral_session();
        let iv: [u8; 16] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
        let json = r#"{"username":"snowy","password":"SuperSecret!123","totp":"482910"}"#;
        let payload = encrypt_like_mobile(json, &sess.key_hex, &iv);

        let decrypted = decrypt_relay_payload(&payload.iv, &payload.data, &sess.key_hex).unwrap();
        assert_eq!(decrypted.as_str(), json);

        let parsed: DecryptedLoginData = serde_json::from_str(&decrypted).unwrap();
        assert_eq!(parsed.username.as_deref(), Some("snowy"));
        assert_eq!(parsed.password.as_deref(), Some("SuperSecret!123"));
        assert_eq!(parsed.totp.as_deref(), Some("482910"));
    }

    #[test]
    fn test_tampered_mac_rejected() {
        let sess = generate_ephemeral_session();
        let iv = [7u8; 16];
        let mut payload = encrypt_like_mobile(r#"{"username":"a","password":"b"}"#, &sess.key_hex, &iv);
        payload.data[0] ^= 0xFF;
        let res = decrypt_relay_payload(&payload.iv, &payload.data, &sess.key_hex);
        assert!(res.is_err());
    }

    #[test]
    fn test_invalid_iv_or_key_rejected() {
        let res = decrypt_relay_payload(&[0u8; 8], &[0u8; 40], &"0".repeat(64));
        assert!(res.is_err());
        let res_key = decrypt_relay_payload(&[0u8; 16], &[0u8; 40], "badhex");
        assert!(res_key.is_err());
    }
}
