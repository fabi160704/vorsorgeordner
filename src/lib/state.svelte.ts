import { backend } from "./backend";
import {
  emptyVault,
  newId,
  nowIso,
  parseVault,
  serializeVault,
  type Attachment,
  type Entry,
  type Person,
  type SettlementStatus,
  type Vault,
} from "./model";

const RECENT_KEY = "vorsorgeordner.recentPath";

function readRecent(): string | null {
  try {
    return localStorage.getItem(RECENT_KEY);
  } catch {
    return null;
  }
}

function writeRecent(path: string | null) {
  try {
    if (path) localStorage.setItem(RECENT_KEY, path);
    else localStorage.removeItem(RECENT_KEY);
  } catch {
    // Ohne localStorage fehlt nur der Vorschlag der zuletzt geöffneten Datei.
  }
}

class Store {
  vault = $state<Vault | null>(null);
  path = $state<string | null>(null);
  recentPath = $state<string | null>(readRecent());
  dirty = $state(false);
  saving = $state(false);
  /** Zählt jede Änderung. Damit erkennt save(), ob während des Speicherns weiter geändert wurde. */
  changes = $state(0);
  lastError = $state<string | null>(null);
  /** Hinweis auf dem Entsperr-Bildschirm, z. B. nach automatischem Sperren. */
  lockMessage = $state<string | null>(null);

  /**
   * Anhänge, die in dieser Sitzung hinzugefügt wurden. Sie dürfen beim
   * Aufräumen nicht gelöscht werden, auch wenn noch kein gespeicherter
   * Eintrag auf sie verweist (z. B. weil das Formular noch offen ist).
   */
  private pendingAttachments = new Set<string>();

  async open(path: string, passphrase: string) {
    const json = await backend.open(path, passphrase);
    this.vault = parseVault(json);
    this.path = path;
    this.dirty = false;
    this.lockMessage = null;
    this.recentPath = path;
    writeRecent(path);
  }

  async create(path: string, passphrase: string) {
    const vault = emptyVault();
    await backend.create(path, passphrase, serializeVault(vault));
    this.vault = vault;
    this.path = path;
    this.dirty = false;
    this.recentPath = path;
    writeRecent(path);
  }

  /** Markiert den Vorsorgeordner als geändert. */
  private touch() {
    this.dirty = true;
    this.changes += 1;
  }

  async save() {
    if (!this.vault || this.saving) return;
    this.saving = true;
    const revision = this.changes;
    try {
      this.vault.updatedAt = nowIso();
      await backend.save(serializeVault($state.snapshot(this.vault) as Vault));
      // Änderungen während des Speicherns bleiben als ungespeichert markiert.
      this.dirty = this.changes !== revision;
      this.lastError = null;
    } finally {
      this.saving = false;
    }
    await this.pruneAttachments();
  }

  /** Löscht Anhang-Dateien, auf die nichts mehr verweist. Fehler dabei sind nicht kritisch. */
  private async pruneAttachments() {
    if (!this.vault) return;
    const keep = new Set(this.pendingAttachments);
    for (const entry of this.vault.entries) for (const a of entry.attachments) keep.add(a.id);
    try {
      await backend.attachmentPrune([...keep]);
    } catch {
      // Übrig gebliebene Dateien werden beim nächsten Speichern erneut geprüft.
    }
  }

  /** Name des Ordners mit den Anhängen, z. B. "Vorsorgeordner.anhaenge". */
  get attachmentFolderName(): string {
    const name = this.path?.split(/[\\/]/).pop() ?? "";
    return `${name.replace(/\.[^.]*$/, "")}.anhaenge`;
  }

  /**
   * Verschlüsselt eine Datei als Anhang. Der Verweis wird erst mit dem
   * Eintrag gespeichert. Beim ersten Anhang entsteht der Schlüssel.
   */
  async addAttachment(source: string): Promise<Attachment> {
    if (!this.vault) throw new Error("Es ist kein Vorsorgeordner geöffnet.");
    if (!this.vault.attachmentKey) {
      this.vault.attachmentKey = await backend.attachmentNewKey();
      this.touch();
    }
    const id = newId();
    this.pendingAttachments.add(id);
    const size = await backend.attachmentAdd(this.vault.attachmentKey, id, source);
    return { id, name: source.split(/[\\/]/).pop() || "Anhang", size, addedAt: nowIso() };
  }

  openAttachment(attachment: Attachment) {
    return backend.attachmentOpen(this.vault?.attachmentKey ?? "", attachment.id, attachment.name);
  }

  saveAttachmentAs(attachment: Attachment) {
    return backend.attachmentSaveAs(this.vault?.attachmentKey ?? "", attachment.id, attachment.name);
  }

  setEntryStatus(id: string, status: SettlementStatus, statusNotes?: string) {
    const entry = this.vault?.entries.find((e) => e.id === id);
    if (!entry) return;
    entry.status = status;
    if (statusNotes !== undefined) entry.statusNotes = statusNotes;
    entry.updatedAt = nowIso();
    this.touch();
  }

  setEstateStep(key: string, status: SettlementStatus) {
    if (!this.vault || this.vault.estateSteps[key] === status) return;
    this.vault.estateSteps[key] = status;
    this.touch();
  }

  async close(message: string | null = null) {
    await backend.close();
    this.vault = null;
    this.path = null;
    this.dirty = false;
    this.lastError = null;
    this.lockMessage = message;
    this.pendingAttachments.clear();
  }

  /** Speichert den aktuellen Stand mit neuer Passphrase. Ungespeicherte Änderungen werden mitgespeichert. */
  async changePassphrase(current: string, next: string) {
    if (!this.vault) return;
    this.saving = true;
    const revision = this.changes;
    try {
      this.vault.updatedAt = nowIso();
      await backend.changePassphrase(current, next, serializeVault($state.snapshot(this.vault) as Vault));
      this.dirty = this.changes !== revision;
    } finally {
      this.saving = false;
    }
  }

  snapshot(): Vault | null {
    return this.vault ? ($state.snapshot(this.vault) as Vault) : null;
  }

  setAutoSave(enabled: boolean) {
    if (!this.vault || this.vault.settings.autoSave === enabled) return;
    this.vault.settings.autoSave = enabled;
    this.touch();
  }

  get autoSave(): boolean {
    return this.vault?.settings.autoSave ?? false;
  }

  setAutoLock(minutes: number) {
    if (!this.vault || this.vault.settings.autoLockMinutes === minutes) return;
    this.vault.settings.autoLockMinutes = minutes;
    this.touch();
  }

  /** Markiert einen Punkt der Checkliste als "trifft nicht zu" oder nimmt die Markierung zurück. */
  toggleDismissed(key: string) {
    if (!this.vault) return;
    const list = this.vault.dismissedSuggestions;
    this.vault.dismissedSuggestions = list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
    this.touch();
  }

  upsertEntry(entry: Entry) {
    if (!this.vault) return;
    const updated = { ...entry, updatedAt: nowIso() };
    const index = this.vault.entries.findIndex((e) => e.id === entry.id);
    if (index >= 0) this.vault.entries[index] = updated;
    else this.vault.entries.push(updated);
    this.touch();
  }

  deleteEntry(id: string) {
    if (!this.vault) return;
    this.vault.entries = this.vault.entries.filter((e) => e.id !== id);
    this.touch();
  }

  upsertPerson(person: Person) {
    if (!this.vault) return;
    const index = this.vault.persons.findIndex((p) => p.id === person.id);
    if (index >= 0) this.vault.persons[index] = person;
    else this.vault.persons.push(person);
    this.touch();
  }

  /** Entfernt die Person. Ihre Einträge bleiben erhalten und verlieren nur die Zuordnung. */
  deletePerson(id: string) {
    if (!this.vault) return;
    this.vault.persons = this.vault.persons.filter((p) => p.id !== id);
    for (const entry of this.vault.entries) {
      entry.personIds = entry.personIds.filter((pid) => pid !== id);
    }
    this.touch();
  }
}

export const store = new Store();
