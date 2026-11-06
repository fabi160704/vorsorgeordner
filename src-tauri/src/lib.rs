mod attachments;
mod vault;

use std::path::PathBuf;
use std::sync::Mutex;

use age::secrecy::SecretString;
use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;

use vault::VaultError;

/// Geöffnete Datei und Passphrase. Die Passphrase bleibt nur im Rust-Teil und
/// wird nach dem Entsperren nicht mehr an das Frontend gegeben.
struct Session {
    path: PathBuf,
    passphrase: SecretString,
    /// Ob in dieser Sitzung schon eine Sicherung `.bak` geschrieben wurde.
    /// Die Sicherung entsteht beim ersten Speichern nach dem Öffnen und
    /// enthält damit den Stand vom Öffnen, auch wenn danach oft gespeichert wird.
    backup_done: bool,
}

#[derive(Default)]
struct AppState {
    session: Mutex<Option<Session>>,
}

impl AppState {
    fn set(&self, session: Option<Session>) {
        *self.session.lock().unwrap_or_else(|e| e.into_inner()) = session;
    }

    /// Kopie von Pfad und Passphrase der geöffneten Datei.
    fn current(&self) -> Result<(PathBuf, SecretString), VaultError> {
        let guard = self.session.lock().unwrap_or_else(|e| e.into_inner());
        let session = guard.as_ref().ok_or(VaultError::NotOpen)?;
        Ok((session.path.clone(), session.passphrase.clone()))
    }

    fn backup_done(&self) -> bool {
        let guard = self.session.lock().unwrap_or_else(|e| e.into_inner());
        guard.as_ref().is_some_and(|s| s.backup_done)
    }

    fn mark_backup_done(&self) {
        let mut guard = self.session.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(session) = guard.as_mut() {
            session.backup_done = true;
        }
    }
}

/// Ordner für entschlüsselte Kopien von Anhängen, die gerade geöffnet sind.
/// Er wird beim Sperren und beim Beenden gelöscht.
fn temp_root() -> PathBuf {
    std::env::temp_dir().join(format!("vorsorgeordner-{}", std::process::id()))
}

fn remove_temp_copies() {
    let _ = std::fs::remove_dir_all(temp_root());
}

/// scrypt braucht bewusst etwa eine Sekunde. Das läuft in einem eigenen Thread,
/// damit die Oberfläche nicht blockiert.
async fn blocking<T: Send + 'static>(
    f: impl FnOnce() -> Result<T, VaultError> + Send + 'static,
) -> Result<T, VaultError> {
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| VaultError::Encrypt(e.to_string()))?
}

#[tauri::command]
async fn vault_create(
    state: State<'_, AppState>,
    path: String,
    passphrase: String,
    content: String,
) -> Result<(), VaultError> {
    vault::check_passphrase(&passphrase)?;
    let path = PathBuf::from(path);
    let passphrase = SecretString::from(passphrase);
    {
        let (path, passphrase) = (path.clone(), passphrase.clone());
        blocking(move || vault::write_vault(&path, &passphrase, &content)).await?;
    }
    state.set(Some(Session { path, passphrase, backup_done: true }));
    Ok(())
}

#[tauri::command]
async fn vault_open(
    state: State<'_, AppState>,
    path: String,
    passphrase: String,
) -> Result<String, VaultError> {
    let path = PathBuf::from(path);
    let passphrase = SecretString::from(passphrase);
    let content = {
        let (path, passphrase) = (path.clone(), passphrase.clone());
        blocking(move || vault::read_vault(&path, &passphrase)).await?
    };
    state.set(Some(Session { path, passphrase, backup_done: false }));
    Ok(content)
}

#[tauri::command]
async fn vault_save(state: State<'_, AppState>, content: String) -> Result<(), VaultError> {
    let (path, passphrase) = state.current()?;
    let keep_backup = !state.backup_done();
    blocking(move || vault::write_vault_with(&path, &passphrase, &content, keep_backup)).await?;
    state.mark_backup_done();
    Ok(())
}

/// Speichert den aktuellen Inhalt mit einer neuen Passphrase.
#[tauri::command]
async fn vault_change_passphrase(
    state: State<'_, AppState>,
    current: String,
    next: String,
    content: String,
) -> Result<(), VaultError> {
    let (path, old) = state.current()?;
    vault::verify_passphrase(&old, &current)?;
    vault::check_passphrase(&next)?;
    let next = SecretString::from(next);
    {
        let (path, next) = (path.clone(), next.clone());
        blocking(move || vault::change_passphrase(&path, &old, &next, &content)).await?;
    }
    state.set(Some(Session { path, passphrase: next, backup_done: true }));
    Ok(())
}

/// Schreibt einen unverschlüsselten Export (JSON oder CSV).
#[tauri::command]
fn export_plain(state: State<'_, AppState>, path: String, content: String) -> Result<(), VaultError> {
    let vault_path = state.current().ok().map(|(p, _)| p);
    vault::write_export(&PathBuf::from(path), vault_path.as_deref(), &content)
}

#[tauri::command]
fn vault_close(state: State<'_, AppState>) {
    state.set(None);
    remove_temp_copies();
}

#[tauri::command]
fn attachment_new_key() -> String {
    attachments::generate_key()
}

/// Verschlüsselt eine Datei als Anhang. Gibt die Größe in Bytes zurück.
#[tauri::command]
async fn attachment_add(
    state: State<'_, AppState>,
    key: String,
    id: String,
    source: String,
) -> Result<u64, VaultError> {
    let (vault_path, _) = state.current()?;
    blocking(move || attachments::add(&vault_path, &key, &id, &PathBuf::from(source))).await
}

/// Öffnet einen Anhang mit dem Standardprogramm des Betriebssystems.
#[tauri::command]
async fn attachment_open(
    app: AppHandle,
    state: State<'_, AppState>,
    key: String,
    id: String,
    name: String,
) -> Result<(), VaultError> {
    let (vault_path, _) = state.current()?;
    let path = blocking(move || attachments::decrypt_to_temp(&vault_path, &key, &id, &name, &temp_root())).await?;
    app.opener()
        .open_path(path.to_string_lossy(), None::<&str>)
        .map_err(|e| VaultError::Open(e.to_string()))
}

#[tauri::command]
async fn attachment_save_as(
    state: State<'_, AppState>,
    key: String,
    id: String,
    target: String,
) -> Result<(), VaultError> {
    let (vault_path, _) = state.current()?;
    blocking(move || attachments::save_as(&vault_path, &key, &id, &PathBuf::from(target))).await
}

/// Löscht Anhänge, auf die der Vorsorgeordner nicht mehr verweist.
#[tauri::command]
async fn attachment_prune(state: State<'_, AppState>, keep: Vec<String>) -> Result<usize, VaultError> {
    let (vault_path, _) = state.current()?;
    blocking(move || attachments::prune(&vault_path, &keep)).await
}

#[tauri::command]
fn print_page(webview: tauri::Webview) -> Result<(), String> {
    webview.print().map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            vault_create,
            vault_open,
            vault_save,
            vault_change_passphrase,
            vault_close,
            export_plain,
            attachment_new_key,
            attachment_add,
            attachment_open,
            attachment_save_as,
            attachment_prune,
            print_page
        ])
        .build(tauri::generate_context!())
        .expect("Fehler beim Starten der Anwendung")
        .run(|_app, event| {
            if let tauri::RunEvent::Exit = event {
                remove_temp_copies();
            }
        });
}
