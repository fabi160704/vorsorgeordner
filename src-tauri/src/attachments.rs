//! Verschlüsselte Anhänge (z. B. gescannte Policen).
//!
//! Jeder Vorsorgeordner hat einen eigenen age-Schlüssel (X25519), der im
//! verschlüsselten JSON-Dokument als `attachmentKey` steht. Jeder Anhang
//! liegt als eigene Datei `<id>.age` im Ordner `<Dateiname>.anhaenge` neben
//! dem Vorsorgeordner. Wer den Vorsorgeordner entschlüsseln kann, kann damit
//! auch die Anhänge entschlüsseln, auch ohne diese App:
//!
//! ```text
//! age --decrypt -i schluessel.txt -o Police.pdf Vorsorgeordner.anhaenge/<id>.age
//! ```
//!
//! Weil die Anhänge nicht mit der Passphrase verschlüsselt sind, müssen sie
//! beim Ändern der Passphrase nicht neu verschlüsselt werden.

use std::fs;
use std::path::{Path, PathBuf};

use age::secrecy::ExposeSecret;
use age::x25519;

use crate::vault::{write_atomic, write_export_bytes, VaultError};

/// Obergrenze pro Anhang.
const MAX_ATTACHMENT_BYTES: u64 = 50 * 1024 * 1024;

/// Ordner für die Anhänge: `Vorsorgeordner.age` → `Vorsorgeordner.anhaenge`.
pub fn folder_for(vault_path: &Path) -> PathBuf {
    let mut name = vault_path.file_stem().unwrap_or_default().to_os_string();
    name.push(".anhaenge");
    vault_path.with_file_name(name)
}

pub fn generate_key() -> String {
    x25519::Identity::generate().to_string().expose_secret().to_owned()
}

fn parse_key(key: &str) -> Result<x25519::Identity, VaultError> {
    key.trim().parse().map_err(|_| VaultError::InvalidKey)
}

/// Kennungen sind UUIDs. Alles andere wird abgelehnt, damit kein Pfad
/// außerhalb des Anhang-Ordners entstehen kann.
fn is_valid_id(id: &str) -> bool {
    id.len() == 36 && id.chars().all(|c| c.is_ascii_hexdigit() || c == '-')
}

fn attachment_path(vault_path: &Path, id: &str) -> Result<PathBuf, VaultError> {
    if !is_valid_id(id) {
        return Err(VaultError::InvalidAttachmentId);
    }
    Ok(folder_for(vault_path).join(format!("{id}.age")))
}

/// Verschlüsselt die Datei `source` als Anhang `id`. Gibt die Größe in Bytes zurück.
pub fn add(vault_path: &Path, key: &str, id: &str, source: &Path) -> Result<u64, VaultError> {
    let target = attachment_path(vault_path, id)?;
    let identity = parse_key(key)?;
    let size = fs::metadata(source)?.len();
    if size > MAX_ATTACHMENT_BYTES {
        return Err(VaultError::TooLarge);
    }
    let plaintext = fs::read(source)?;
    let ciphertext = age::encrypt(&identity.to_public(), &plaintext).map_err(|e| VaultError::Encrypt(e.to_string()))?;
    fs::create_dir_all(folder_for(vault_path))?;
    write_atomic(&target, &ciphertext, false)?;
    Ok(size)
}

pub fn decrypt(vault_path: &Path, key: &str, id: &str) -> Result<Vec<u8>, VaultError> {
    let path = attachment_path(vault_path, id)?;
    let identity = parse_key(key)?;
    let ciphertext = fs::read(&path).map_err(|e| match e.kind() {
        std::io::ErrorKind::NotFound => VaultError::AttachmentMissing,
        _ => VaultError::Io(e),
    })?;
    age::decrypt(&identity, &ciphertext).map_err(|_| VaultError::Decrypt)
}

/// Entschlüsselt einen Anhang an einen gewählten Ort. Verschlüsselte Dateien
/// werden dabei nicht überschrieben.
pub fn save_as(vault_path: &Path, key: &str, id: &str, target: &Path) -> Result<(), VaultError> {
    let plaintext = decrypt(vault_path, key, id)?;
    write_export_bytes(target, Some(vault_path), &plaintext)
}

/// Entschlüsselt einen Anhang in den temporären Ordner der App, damit ihn das
/// Betriebssystem mit dem passenden Programm öffnen kann.
pub fn decrypt_to_temp(
    vault_path: &Path,
    key: &str,
    id: &str,
    name: &str,
    temp_root: &Path,
) -> Result<PathBuf, VaultError> {
    let plaintext = decrypt(vault_path, key, id)?;
    // id ist geprüft und ergibt einen eigenen Unterordner je Anhang.
    let dir = temp_root.join(id);
    fs::create_dir_all(&dir)?;
    let path = dir.join(sanitize_file_name(name));
    fs::write(&path, plaintext)?;
    Ok(path)
}

/// Löscht Anhänge, auf die der Vorsorgeordner nicht mehr verweist.
/// Gibt die Zahl der gelöschten Dateien zurück.
pub fn prune(vault_path: &Path, keep: &[String]) -> Result<usize, VaultError> {
    let folder = folder_for(vault_path);
    if !folder.is_dir() {
        return Ok(0);
    }
    let mut removed = 0;
    for entry in fs::read_dir(&folder)? {
        let path = entry?.path();
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else { continue };
        let Some(id) = name.strip_suffix(".age") else { continue };
        if is_valid_id(id) && !keep.iter().any(|k| k == id) {
            fs::remove_file(&path)?;
            removed += 1;
        }
    }
    Ok(removed)
}

/// Ersetzt Zeichen, die unter Windows, macOS oder Linux in Dateinamen nicht erlaubt sind.
pub fn sanitize_file_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| if c.is_control() || r#"<>:"/\|?*"#.contains(c) { '_' } else { c })
        .collect();
    let trimmed = cleaned.trim().trim_matches('.').trim();
    if trimmed.is_empty() {
        "anhang".to_owned()
    } else {
        trimmed.to_owned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const ID: &str = "0f8fad5b-d9cb-469f-a165-70867728950e";

    fn setup() -> (tempfile::TempDir, PathBuf, String) {
        let dir = tempfile::tempdir().unwrap();
        let vault = dir.path().join("Vorsorgeordner.age");
        (dir, vault, generate_key())
    }

    #[test]
    fn folder_sits_next_to_vault() {
        assert_eq!(folder_for(Path::new("/a/b/Vorsorgeordner.age")), Path::new("/a/b/Vorsorgeordner.anhaenge"));
    }

    #[test]
    fn add_and_decrypt_roundtrip() {
        let (dir, vault, key) = setup();
        let source = dir.path().join("Police.pdf");
        fs::write(&source, b"%PDF-1.4 Inhalt").unwrap();

        let size = add(&vault, &key, ID, &source).unwrap();
        assert_eq!(size, 15);

        let stored = fs::read(folder_for(&vault).join(format!("{ID}.age"))).unwrap();
        assert!(stored.starts_with(b"age-encryption.org/v1"));
        assert_eq!(decrypt(&vault, &key, ID).unwrap(), b"%PDF-1.4 Inhalt");

        let other_key = generate_key();
        assert!(matches!(decrypt(&vault, &other_key, ID), Err(VaultError::Decrypt)));
    }

    #[test]
    fn rejects_bad_ids_and_keys() {
        let (dir, vault, key) = setup();
        let source = dir.path().join("x.txt");
        fs::write(&source, b"x").unwrap();
        for id in ["../../etc/passwd", "", "0f8fad5b-d9cb-469f-a165-70867728950e/../x"] {
            assert!(matches!(add(&vault, &key, id, &source), Err(VaultError::InvalidAttachmentId)));
        }
        assert!(matches!(add(&vault, "kein schlüssel", ID, &source), Err(VaultError::InvalidKey)));
        assert!(matches!(decrypt(&vault, &key, ID), Err(VaultError::AttachmentMissing)));
    }

    #[test]
    fn prune_removes_only_unreferenced_attachments() {
        let (dir, vault, key) = setup();
        let source = dir.path().join("x.txt");
        fs::write(&source, b"x").unwrap();
        let keep = "11111111-1111-4111-8111-111111111111";
        add(&vault, &key, ID, &source).unwrap();
        add(&vault, &key, keep, &source).unwrap();
        let foreign = folder_for(&vault).join("notiz.txt");
        fs::write(&foreign, b"bleibt").unwrap();

        assert_eq!(prune(&vault, &[keep.to_owned()]).unwrap(), 1);
        assert!(!folder_for(&vault).join(format!("{ID}.age")).exists());
        assert!(folder_for(&vault).join(format!("{keep}.age")).exists());
        assert!(foreign.exists());
    }

    #[test]
    fn save_as_and_temp_copy() {
        let (dir, vault, key) = setup();
        let source = dir.path().join("x.txt");
        fs::write(&source, b"Inhalt").unwrap();
        add(&vault, &key, ID, &source).unwrap();

        let target = dir.path().join("kopie.txt");
        save_as(&vault, &key, ID, &target).unwrap();
        assert_eq!(fs::read(&target).unwrap(), b"Inhalt");
        assert!(matches!(
            save_as(&vault, &key, ID, &dir.path().join("x.age")),
            Err(VaultError::ExportWouldOverwriteVault)
        ));

        let temp = dir.path().join("tmp");
        let path = decrypt_to_temp(&vault, &key, ID, "Police: 2026?.pdf", &temp).unwrap();
        assert_eq!(path.file_name().unwrap(), "Police_ 2026_.pdf");
        assert_eq!(fs::read(&path).unwrap(), b"Inhalt");
    }

    #[test]
    fn sanitizes_names() {
        assert_eq!(sanitize_file_name("a/b\\c.pdf"), "a_b_c.pdf");
        assert_eq!(sanitize_file_name(" .. "), "anhang");
        assert_eq!(sanitize_file_name("Scan März.jpg"), "Scan März.jpg");
    }
}
