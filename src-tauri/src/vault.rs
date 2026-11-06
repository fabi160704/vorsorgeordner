//! Verschlüsselte Ablage des Vorsorgeordners.
//!
//! Der Inhalt ist ein JSON-Dokument, das mit dem age-Format
//! (https://age-encryption.org/v1) und einer Passphrase (scrypt) verschlüsselt
//! wird. Dadurch lässt sich die Datei auch ohne diese App mit dem age- oder
//! rage-Kommandozeilenwerkzeug entschlüsseln:
//!
//! ```text
//! age --decrypt -o vorsorgeordner.json Vorsorgeordner.age
//! ```

use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};

use age::secrecy::{ExposeSecret, SecretString};

/// Mindestlänge der Passphrase in Zeichen.
pub const MIN_PASSPHRASE_LEN: usize = 12;

/// Obergrenze für die Dateigröße, damit keine beliebig großen Dateien in den
/// Speicher geladen werden. Ein Vorsorgeordner ohne Anhänge bleibt weit darunter.
const MAX_FILE_BYTES: u64 = 50 * 1024 * 1024;

#[derive(Debug, thiserror::Error)]
pub enum VaultError {
    #[error("Die Datei konnte nicht gelesen oder geschrieben werden: {0}")]
    Io(#[from] std::io::Error),
    #[error("Die Passphrase ist falsch oder die Datei ist beschädigt.")]
    Decrypt,
    #[error("Die Verschlüsselung ist fehlgeschlagen: {0}")]
    Encrypt(String),
    #[error("Der Inhalt ist kein gültiges JSON: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Die Passphrase muss mindestens {MIN_PASSPHRASE_LEN} Zeichen lang sein.")]
    PassphraseTooShort,
    #[error("Die Datei ist zu groß.")]
    TooLarge,
    #[error("Es ist kein Vorsorgeordner geöffnet.")]
    NotOpen,
    #[error("Die bisherige Passphrase ist falsch.")]
    WrongPassphrase,
    #[error("Ein Export darf keine verschlüsselte .age-Datei überschreiben.")]
    ExportWouldOverwriteVault,
    #[error("Der Schlüssel für die Anhänge ist ungültig.")]
    InvalidKey,
    #[error("Der Anhang wurde nicht gefunden. Liegt der Ordner mit den Anhängen neben der Datei?")]
    AttachmentMissing,
    #[error("Ungültige Kennung für einen Anhang.")]
    InvalidAttachmentId,
    #[error("Die Datei konnte nicht geöffnet werden: {0}")]
    Open(String),
}

// Tauri gibt Fehler als Wert an das Frontend weiter; dort genügt der Text.
impl serde::Serialize for VaultError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

pub fn check_passphrase(passphrase: &str) -> Result<(), VaultError> {
    if passphrase.chars().count() < MIN_PASSPHRASE_LEN {
        return Err(VaultError::PassphraseTooShort);
    }
    Ok(())
}

/// Prüft, dass der Inhalt gültiges JSON ist, bevor er verschlüsselt wird.
pub fn check_json(content: &str) -> Result<(), VaultError> {
    serde_json::from_str::<serde_json::Value>(content)?;
    Ok(())
}

pub fn encrypt(plaintext: &[u8], passphrase: &SecretString) -> Result<Vec<u8>, VaultError> {
    let recipient = age::scrypt::Recipient::new(passphrase.clone());
    age::encrypt(&recipient, plaintext).map_err(|e| VaultError::Encrypt(e.to_string()))
}

pub fn decrypt(ciphertext: &[u8], passphrase: &SecretString) -> Result<Vec<u8>, VaultError> {
    let identity = age::scrypt::Identity::new(passphrase.clone());
    age::decrypt(&identity, ciphertext).map_err(|_| VaultError::Decrypt)
}

/// Liest und entschlüsselt eine Datei und gibt den JSON-Inhalt zurück.
pub fn read_vault(path: &Path, passphrase: &SecretString) -> Result<String, VaultError> {
    if fs::metadata(path)?.len() > MAX_FILE_BYTES {
        return Err(VaultError::TooLarge);
    }
    let ciphertext = fs::read(path)?;
    let plaintext = decrypt(&ciphertext, passphrase)?;
    let content = String::from_utf8(plaintext).map_err(|_| VaultError::Decrypt)?;
    check_json(&content)?;
    Ok(content)
}

/// Verschlüsselt den JSON-Inhalt und schreibt ihn sicher auf die Platte.
pub fn write_vault(path: &Path, passphrase: &SecretString, content: &str) -> Result<(), VaultError> {
    check_json(content)?;
    let ciphertext = encrypt(content.as_bytes(), passphrase)?;
    write_atomic(path, &ciphertext, true)?;
    Ok(())
}

/// Prüft die bisherige Passphrase gegen die der geöffneten Datei.
pub fn verify_passphrase(expected: &SecretString, given: &str) -> Result<(), VaultError> {
    if expected.expose_secret() != given {
        return Err(VaultError::WrongPassphrase);
    }
    Ok(())
}

/// Speichert den Inhalt mit einer neuen Passphrase.
///
/// Die Sicherungskopie `.bak` wird ebenfalls auf die neue Passphrase
/// umgestellt. Sonst bliebe neben der Datei eine Kopie liegen, die sich mit
/// der alten Passphrase öffnen lässt. Lässt sich die Sicherung mit der alten
/// Passphrase nicht öffnen, bleibt sie unverändert.
pub fn change_passphrase(
    path: &Path,
    old: &SecretString,
    new: &SecretString,
    content: &str,
) -> Result<(), VaultError> {
    write_vault(path, new, content)?;
    let backup = backup_path(path);
    if backup.exists() {
        if let Ok(previous) = read_vault(&backup, old) {
            let ciphertext = encrypt(previous.as_bytes(), new)?;
            write_atomic(&backup, &ciphertext, false)?;
        }
    }
    Ok(())
}

/// Schreibt einen unverschlüsselten Export. Verschlüsselte Dateien werden
/// dabei nie überschrieben, damit ein Export nicht versehentlich den
/// Vorsorgeordner im Klartext ersetzt.
pub fn write_export(path: &Path, vault_path: Option<&Path>, content: &str) -> Result<(), VaultError> {
    write_export_bytes(path, vault_path, content.as_bytes())
}

pub fn write_export_bytes(path: &Path, vault_path: Option<&Path>, content: &[u8]) -> Result<(), VaultError> {
    let is_age = path
        .extension()
        .is_some_and(|ext| ext.eq_ignore_ascii_case("age") || ext.eq_ignore_ascii_case("bak"));
    if is_age || vault_path.is_some_and(|v| v == path) || looks_like_age_file(path) {
        return Err(VaultError::ExportWouldOverwriteVault);
    }
    write_atomic(path, content, false)?;
    Ok(())
}

fn looks_like_age_file(path: &Path) -> bool {
    use std::io::Read;
    let mut header = [0u8; 21];
    File::open(path)
        .and_then(|mut f| f.read_exact(&mut header))
        .is_ok_and(|_| &header == b"age-encryption.org/v1")
}

fn sibling_with_suffix(path: &Path, suffix: &str) -> PathBuf {
    let mut name = path.file_name().unwrap_or_default().to_os_string();
    name.push(suffix);
    path.with_file_name(name)
}

pub fn backup_path(path: &Path) -> PathBuf {
    sibling_with_suffix(path, ".bak")
}

/// Schreibt zuerst in eine temporäre Datei und ersetzt dann das Original.
/// Mit `keep_backup` bleibt die vorherige Version als `<datei>.bak` erhalten.
/// So geht bei einem Absturz während des Speicherns nie der letzte gültige
/// Stand verloren.
pub(crate) fn write_atomic(path: &Path, data: &[u8], keep_backup: bool) -> std::io::Result<()> {
    let tmp = sibling_with_suffix(path, ".tmp");
    {
        let mut file = File::create(&tmp)?;
        file.write_all(data)?;
        file.sync_all()?;
    }
    if keep_backup && path.exists() {
        fs::copy(path, backup_path(path))?;
    }
    fs::rename(&tmp, path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pass(s: &str) -> SecretString {
        SecretString::from(s.to_owned())
    }

    #[test]
    fn roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.age");
        let content = r#"{"formatVersion":1,"persons":[],"entries":[]}"#;

        write_vault(&path, &pass("korrekte passphrase"), content).unwrap();
        let read = read_vault(&path, &pass("korrekte passphrase")).unwrap();
        assert_eq!(read, content);

        // Die Datei enthält den Klartext nicht.
        let raw = fs::read(&path).unwrap();
        assert!(raw.starts_with(b"age-encryption.org/v1"));
        assert!(!String::from_utf8_lossy(&raw).contains("formatVersion"));
    }

    #[test]
    fn wrong_passphrase_fails() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.age");
        write_vault(&path, &pass("korrekte passphrase"), "{}").unwrap();
        let err = read_vault(&path, &pass("falsche passphrase")).unwrap_err();
        assert!(matches!(err, VaultError::Decrypt));
    }

    #[test]
    fn second_save_keeps_backup() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.age");
        let p = pass("korrekte passphrase");
        write_vault(&path, &p, r#"{"v":1}"#).unwrap();
        write_vault(&path, &p, r#"{"v":2}"#).unwrap();

        assert_eq!(read_vault(&path, &p).unwrap(), r#"{"v":2}"#);
        assert_eq!(read_vault(&backup_path(&path), &p).unwrap(), r#"{"v":1}"#);
        assert!(!sibling_with_suffix(&path, ".tmp").exists());
    }

    #[test]
    fn rejects_invalid_json() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.age");
        let err = write_vault(&path, &pass("korrekte passphrase"), "kein json").unwrap_err();
        assert!(matches!(err, VaultError::Json(_)));
        assert!(!path.exists());
    }

    #[test]
    fn change_passphrase_reencrypts_file_and_backup() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.age");
        let old = pass("alte passphrase 1");
        let new = pass("neue passphrase 2");
        write_vault(&path, &old, r#"{"v":1}"#).unwrap();

        change_passphrase(&path, &old, &new, r#"{"v":2}"#).unwrap();

        assert_eq!(read_vault(&path, &new).unwrap(), r#"{"v":2}"#);
        assert!(matches!(read_vault(&path, &old), Err(VaultError::Decrypt)));
        // Die Sicherung enthält den vorigen Stand, aber mit der neuen Passphrase.
        assert_eq!(read_vault(&backup_path(&path), &new).unwrap(), r#"{"v":1}"#);
        assert!(matches!(read_vault(&backup_path(&path), &old), Err(VaultError::Decrypt)));
    }

    #[test]
    fn verify_passphrase_compares() {
        let p = pass("korrekte passphrase");
        assert!(verify_passphrase(&p, "korrekte passphrase").is_ok());
        assert!(matches!(verify_passphrase(&p, "falsch"), Err(VaultError::WrongPassphrase)));
    }

    #[test]
    fn export_never_overwrites_encrypted_files() {
        let dir = tempfile::tempdir().unwrap();
        let vault = dir.path().join("ordner.age");
        write_vault(&vault, &pass("korrekte passphrase"), "{}").unwrap();

        // Endung .age, die geöffnete Datei selbst und age-Dateien mit anderer Endung sind tabu.
        let renamed = dir.path().join("kopie.json");
        fs::copy(&vault, &renamed).unwrap();
        for target in [&vault, &dir.path().join("neu.AGE"), &renamed] {
            let err = write_export(target, Some(&vault), "{}").unwrap_err();
            assert!(matches!(err, VaultError::ExportWouldOverwriteVault), "{target:?}");
        }

        let export = dir.path().join("export.csv");
        write_export(&export, Some(&vault), "a;b").unwrap();
        assert_eq!(fs::read_to_string(&export).unwrap(), "a;b");
        assert!(!backup_path(&export).exists());
    }

    #[test]
    fn short_passphrase_is_rejected() {
        assert!(check_passphrase("kurz").is_err());
        assert!(check_passphrase("lang genug, ok").is_ok());
    }
}
