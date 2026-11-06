mod vault;

use std::path::PathBuf;
use std::sync::Mutex;

use age::secrecy::SecretString;
use tauri::State;

use vault::VaultError;

/// Geöffnete Datei und Passphrase. Die Passphrase bleibt nur im Rust-Teil und
/// wird nach dem Entsperren nicht mehr an das Frontend gegeben.
struct Session {
    path: PathBuf,
    passphrase: SecretString,
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
    state.set(Some(Session { path, passphrase }));
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
    state.set(Some(Session { path, passphrase }));
    Ok(content)
}

#[tauri::command]
async fn vault_save(state: State<'_, AppState>, content: String) -> Result<(), VaultError> {
    let (path, passphrase) = state.current()?;
    blocking(move || vault::write_vault(&path, &passphrase, &content)).await
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
    state.set(Some(Session { path, passphrase: next }));
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
}

#[tauri::command]
fn print_page(webview: tauri::Webview) -> Result<(), String> {
    webview.print().map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            vault_create,
            vault_open,
            vault_save,
            vault_change_passphrase,
            vault_close,
            export_plain,
            print_page
        ])
        .run(tauri::generate_context!())
        .expect("Fehler beim Starten der Anwendung");
}
