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
  exportPlain(fileName: string, extension: "json" | "csv", content: string): Promise<string | null>;
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
    const type = extension === "json" ? "application/json" : "text/csv";
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    return fileName;
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
