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
