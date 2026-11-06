import { backend } from "./backend";
import {
  emptyVault,
  nowIso,
  parseVault,
  serializeVault,
  type Entry,
  type Person,
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
  lastError = $state<string | null>(null);

  async open(path: string, passphrase: string) {
    const json = await backend.open(path, passphrase);
    this.vault = parseVault(json);
    this.path = path;
    this.dirty = false;
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

  async save() {
    if (!this.vault || this.saving) return;
    this.saving = true;
    try {
      this.vault.updatedAt = nowIso();
      await backend.save(serializeVault($state.snapshot(this.vault) as Vault));
      this.dirty = false;
      this.lastError = null;
    } finally {
      this.saving = false;
    }
  }

  async close() {
    await backend.close();
    this.vault = null;
    this.path = null;
    this.dirty = false;
  }

  upsertEntry(entry: Entry) {
    if (!this.vault) return;
    const updated = { ...entry, updatedAt: nowIso() };
    const index = this.vault.entries.findIndex((e) => e.id === entry.id);
    if (index >= 0) this.vault.entries[index] = updated;
    else this.vault.entries.push(updated);
    this.dirty = true;
  }

  deleteEntry(id: string) {
    if (!this.vault) return;
    this.vault.entries = this.vault.entries.filter((e) => e.id !== id);
    this.dirty = true;
  }

  upsertPerson(person: Person) {
    if (!this.vault) return;
    const index = this.vault.persons.findIndex((p) => p.id === person.id);
    if (index >= 0) this.vault.persons[index] = person;
    else this.vault.persons.push(person);
    this.dirty = true;
  }

  /** Entfernt die Person. Ihre Einträge bleiben erhalten und verlieren nur die Zuordnung. */
  deletePerson(id: string) {
    if (!this.vault) return;
    this.vault.persons = this.vault.persons.filter((p) => p.id !== id);
    for (const entry of this.vault.entries) {
      entry.personIds = entry.personIds.filter((pid) => pid !== id);
    }
    this.dirty = true;
  }
}

export const store = new Store();
