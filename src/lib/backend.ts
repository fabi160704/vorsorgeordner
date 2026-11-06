// Verbindung zum Rust-Teil der App.
//
// In der Desktop-App laufen Verschlüsselung und Dateizugriff in Rust.
// Im normalen Browser (npm run dev) gibt es eine Vorschau mit Beispieldaten,
// die nichts speichert. Sie dient nur zur Entwicklung der Oberfläche.

import { invoke, isTauri } from "@tauri-apps/api/core";
import { ask, open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { demoVault } from "./demo";
import { serializeVault } from "./model";

export interface Backend {
  readonly isPreview: boolean;
  pickExistingFile(): Promise<string | null>;
  pickNewFile(): Promise<string | null>;
  create(path: string, passphrase: string, content: string): Promise<void>;
  open(path: string, passphrase: string): Promise<string>;
  save(content: string): Promise<void>;
  changePassphrase(current: string, next: string, content: string): Promise<void>;
  /** Fragt nach einem Speicherort und schreibt den Text unverschlüsselt. Gibt den Pfad zurück oder null bei Abbruch. */
  exportPlain(fileName: string, extension: "json" | "csv" | "ics", content: string): Promise<string | null>;
  /** Wählt eine Datei, die als Anhang verschlüsselt werden soll. */
  pickAttachmentSource(): Promise<string | null>;
  attachmentNewKey(): Promise<string>;
  /** Verschlüsselt die Datei als Anhang `id` und gibt die Größe in Bytes zurück. */
  attachmentAdd(key: string, id: string, source: string): Promise<number>;
  attachmentOpen(key: string, id: string, name: string): Promise<void>;
  /** Fragt nach einem Speicherort und legt dort eine entschlüsselte Kopie ab. */
  attachmentSaveAs(key: string, id: string, name: string): Promise<string | null>;
  attachmentPrune(keep: string[]): Promise<void>;
  close(): Promise<void>;
  confirm(message: string): Promise<boolean>;
  print(): Promise<void>;
}

const FILTERS = [{ name: "Vorsorgeordner (age-verschlüsselt)", extensions: ["age"] }];

const tauriBackend: Backend = {
  isPreview: false,
  async pickExistingFile() {
    const path = await openDialog({ multiple: false, directory: false, filters: FILTERS });
    return typeof path === "string" ? path : null;
  },
  pickNewFile() {
    return saveDialog({ defaultPath: "Vorsorgeordner.age", filters: FILTERS });
  },
  create(path, passphrase, content) {
    return invoke("vault_create", { path, passphrase, content });
  },
  open(path, passphrase) {
    return invoke<string>("vault_open", { path, passphrase });
  },
  save(content) {
    return invoke("vault_save", { content });
  },
  changePassphrase(current, next, content) {
    return invoke("vault_change_passphrase", { current, next, content });
  },
  async exportPlain(fileName, extension, content) {
    const path = await saveDialog({
      defaultPath: fileName,
      filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
    });
    if (!path) return null;
    await invoke("export_plain", { path, content });
    return path;
  },
  async pickAttachmentSource() {
    const path = await openDialog({ multiple: false, directory: false });
    return typeof path === "string" ? path : null;
  },
  attachmentNewKey() {
    return invoke<string>("attachment_new_key");
  },
  attachmentAdd(key, id, source) {
    return invoke<number>("attachment_add", { key, id, source });
  },
  attachmentOpen(key, id, name) {
    return invoke("attachment_open", { key, id, name });
  },
  async attachmentSaveAs(key, id, name) {
    const target = await saveDialog({ defaultPath: name });
    if (!target) return null;
    await invoke("attachment_save_as", { key, id, target });
    return target;
  },
  async attachmentPrune(keep) {
    await invoke("attachment_prune", { keep });
  },
  close() {
    return invoke("vault_close");
  },
  confirm(message) {
    return ask(message, { title: "Vorsorgeordner", kind: "warning" });
  },
  print() {
    return invoke("print_page");
  },
};

const previewFiles = new Map<string, File>();
const previewAttachments = new Map<string, Blob>();

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

const previewBackend: Backend = {
  isPreview: true,
  async pickExistingFile() {
    return "Beispiel.age";
  },
  async pickNewFile() {
    return "Neu.age";
  },
  async create() {},
  async open() {
    return serializeVault(demoVault());
  },
  async save() {},
  async changePassphrase() {},
  async exportPlain(fileName, extension, content) {
    // In der Vorschau als Download, damit sich der Export prüfen lässt.
    const types = { json: "application/json", csv: "text/csv", ics: "text/calendar" };
    download(new Blob([content], { type: types[extension] }), fileName);
    return fileName;
  },
  pickAttachmentSource() {
    // In der Vorschau über ein Dateifeld; die Datei bleibt nur im Speicher.
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        const path = `vorschau/${previewFiles.size}/${file.name}`;
        previewFiles.set(path, file);
        resolve(path);
      };
      input.click();
    });
  },
  async attachmentNewKey() {
    return "AGE-SECRET-KEY-1VORSCHAU";
  },
  async attachmentAdd(_key, id, source) {
    const file = previewFiles.get(source);
    if (!file) throw new Error("Datei nicht gefunden.");
    previewAttachments.set(id, file);
    return file.size;
  },
  async attachmentOpen(_key, id) {
    const file = previewAttachments.get(id);
    if (!file) throw new Error("Der Anhang wurde nicht gefunden.");
    window.open(URL.createObjectURL(file), "_blank");
  },
  async attachmentSaveAs(_key, id, name) {
    const file = previewAttachments.get(id);
    if (!file) throw new Error("Der Anhang wurde nicht gefunden.");
    download(file, name);
    return name;
  },
  async attachmentPrune(keep) {
    for (const id of [...previewAttachments.keys()]) {
      if (!keep.includes(id)) previewAttachments.delete(id);
    }
  },
  async close() {},
  async confirm(message) {
    return window.confirm(message);
  },
  async print() {
    window.print();
  },
};

export const backend: Backend = isTauri() ? tauriBackend : previewBackend;

/** Tauri liefert Fehler aus Rust als Text, alles andere als Error-Objekt. */
export function errorMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  return String(err);
}
