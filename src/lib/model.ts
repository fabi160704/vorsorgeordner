// Datenmodell des Vorsorgeordners.
//
// Alles liegt in einem einzigen JSON-Dokument (siehe docs/datenformat.md).
// Felder sind bewusst flach gehalten und leere Werte sind leere Strings,
// damit das entschlüsselte JSON auch ohne die App lesbar bleibt.

export const FORMAT_VERSION = 1;

export type Category =
  | "versicherung"
  | "bank"
  | "vorsorge"
  | "gesundheit"
  | "vertrag"
  | "abo"
  | "wohnen"
  | "fahrzeug"
  | "behoerde"
  | "digital"
  | "dokument"
  | "kontakt"
  | "sonstiges";

export const CATEGORIES: { id: Category; label: string; hint: string }[] = [
  { id: "versicherung", label: "Versicherungen", hint: "Haftpflicht, Hausrat, Leben, Unfall, Kfz" },
  { id: "bank", label: "Banken & Konten", hint: "Girokonto, Sparkonto, Depot, Kredit, Schließfach" },
  { id: "vorsorge", label: "Rente & Altersvorsorge", hint: "Gesetzliche Rente, Betriebsrente, private Vorsorge" },
  { id: "gesundheit", label: "Gesundheit", hint: "Krankenkasse, Pflegekasse, Ärzte" },
  { id: "vertrag", label: "Verträge", hint: "Strom, Gas, Wasser, Internet, Mobilfunk" },
  { id: "abo", label: "Abos & Mitgliedschaften", hint: "Zeitung, Streaming, Verein, Fitnessstudio" },
  { id: "wohnen", label: "Wohnen & Immobilien", hint: "Mietvertrag, Grundbuch, Hausverwaltung" },
  { id: "fahrzeug", label: "Fahrzeuge", hint: "Fahrzeugbrief, Leasing, Finanzierung" },
  { id: "behoerde", label: "Behörden & Steuern", hint: "Finanzamt, Rundfunkbeitrag, Steuer-ID" },
  { id: "digital", label: "Digitale Konten", hint: "E-Mail, soziale Netzwerke, Cloud-Speicher" },
  { id: "dokument", label: "Dokumente & Ablageorte", hint: "Testament, Vorsorgevollmacht, Ausweise, Schlüssel" },
  { id: "kontakt", label: "Wichtige Kontakte", hint: "Notar, Steuerberater, Hausarzt" },
  { id: "sonstiges", label: "Sonstiges", hint: "" },
];

export type Interval = "monatlich" | "vierteljaehrlich" | "halbjaehrlich" | "jaehrlich" | "einmalig";

export const INTERVALS: { id: Interval; label: string; perYear: number }[] = [
  { id: "monatlich", label: "monatlich", perYear: 12 },
  { id: "vierteljaehrlich", label: "vierteljährlich", perYear: 4 },
  { id: "halbjaehrlich", label: "halbjährlich", perYear: 2 },
  { id: "jaehrlich", label: "jährlich", perYear: 1 },
  { id: "einmalig", label: "einmalig", perYear: 0 },
];

/** Was im Todesfall mit dem Eintrag zu tun ist. */
export type DeathAction = "" | "kuendigen" | "umschreiben" | "leistung" | "melden" | "pruefen" | "keine";

export const DEATH_ACTIONS: { id: DeathAction; label: string }[] = [
  { id: "", label: "nicht festgelegt" },
  { id: "kuendigen", label: "kündigen" },
  { id: "umschreiben", label: "umschreiben / übernehmen" },
  { id: "leistung", label: "Leistung beantragen" },
  { id: "melden", label: "Tod melden" },
  { id: "pruefen", label: "prüfen" },
  { id: "keine", label: "nichts tun" },
];

/** Stand der Abwicklung, wenn der Inhaber verstorben ist. */
export type SettlementStatus = "offen" | "in_bearbeitung" | "erledigt";

export const SETTLEMENT_STATUS: { id: SettlementStatus; label: string }[] = [
  { id: "offen", label: "offen" },
  { id: "in_bearbeitung", label: "in Bearbeitung" },
  { id: "erledigt", label: "erledigt" },
];

export interface Person {
  id: string;
  name: string;
  birthDate: string;
  /** Gesetzt, sobald die Person verstorben ist. Schaltet die Abwicklungsansicht frei. */
  deathDate: string;
  /** Allgemeine Hinweise, z. B. Wünsche, Haustiere, Schlüssel. */
  notes: string;
}

export interface Entry {
  id: string;
  category: Category;
  title: string;
  /** Inhaber oder betroffene Personen. Leer bedeutet: gilt für den ganzen Haushalt. */
  personIds: string[];
  provider: string;
  /** Vertrags-, Mitglieds-, Kunden- oder Versicherungsnummer. */
  reference: string;
  /** Telefon, E-Mail, Adresse, Website. */
  contact: string;
  /** Betrag in Cent, null wenn keine Kosten. */
  costCents: number | null;
  interval: Interval;
  /** z. B. "Lastschrift vom Girokonto bei der Sparkasse". */
  paymentMethod: string;
  startDate: string;
  endDate: string;
  noticePeriod: string;
  autoRenew: boolean;
  /** Wo die Zugangsdaten liegen, z. B. "Passwortmanager, Eintrag 'Stadtwerke'". Keine Passwörter. */
  accessHint: string;
  /** Wo die Unterlagen liegen, z. B. "Ordner Versicherungen, Register 3". */
  storageLocation: string;
  deathAction: DeathAction;
  deathNotes: string;
  status: SettlementStatus;
  statusNotes: string;
  notes: string;
  lastReviewed: string;
  createdAt: string;
  updatedAt: string;
}

export interface Vault {
  formatVersion: number;
  createdAt: string;
  updatedAt: string;
  persons: Person[];
  entries: Entry[];
}

export function newId(): string {
  // crypto.randomUUID ist nicht in jedem Webview-Kontext verfügbar.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function emptyVault(): Vault {
  const now = nowIso();
  return { formatVersion: FORMAT_VERSION, createdAt: now, updatedAt: now, persons: [], entries: [] };
}

export function newPerson(fields: Partial<Person> = {}): Person {
  return { id: newId(), name: "", birthDate: "", deathDate: "", notes: "", ...fields };
}

export function newEntry(fields: Partial<Entry> = {}): Entry {
  const now = nowIso();
  return {
    id: newId(),
    category: "versicherung",
    title: "",
    personIds: [],
    provider: "",
    reference: "",
    contact: "",
    costCents: null,
    interval: "monatlich",
    paymentMethod: "",
    startDate: "",
    endDate: "",
    noticePeriod: "",
    autoRenew: false,
    accessHint: "",
    storageLocation: "",
    deathAction: "",
    deathNotes: "",
    status: "offen",
    statusNotes: "",
    notes: "",
    lastReviewed: "",
    createdAt: now,
    updatedAt: now,
    ...fields,
  };
}

/**
 * Liest ein entschlüsseltes JSON-Dokument ein. Fehlende Felder werden mit
 * Standardwerten ergänzt, damit ältere Dateien nach Erweiterungen des
 * Datenmodells weiter funktionieren.
 */
export function parseVault(json: string): Vault {
  const raw = JSON.parse(json) as Partial<Vault>;
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Die Datei enthält keinen Vorsorgeordner.");
  }
  const version = raw.formatVersion ?? FORMAT_VERSION;
  if (version > FORMAT_VERSION) {
    throw new Error(
      `Die Datei wurde mit einer neueren Version erstellt (Format ${version}). Bitte die App aktualisieren.`,
    );
  }
  const base = emptyVault();
  return {
    formatVersion: FORMAT_VERSION,
    createdAt: raw.createdAt ?? base.createdAt,
    updatedAt: raw.updatedAt ?? base.updatedAt,
    persons: Array.isArray(raw.persons) ? raw.persons.map((p) => newPerson(p)) : [],
    entries: Array.isArray(raw.entries) ? raw.entries.map((e) => newEntry(e)) : [],
  };
}

export function serializeVault(vault: Vault): string {
  return JSON.stringify(vault, null, 2);
}

export function perYear(interval: Interval): number {
  return INTERVALS.find((i) => i.id === interval)?.perYear ?? 0;
}

/** Jährliche Kosten in Cent. Einmalige Kosten zählen nicht als laufende Kosten. */
export function yearlyCents(entry: Entry): number {
  if (entry.costCents === null) return 0;
  return entry.costCents * perYear(entry.interval);
}

export function monthlyCents(entry: Entry): number {
  return Math.round(yearlyCents(entry) / 12);
}

/** Gilt ein Eintrag für eine Person? Einträge ohne Person gelten für alle. */
export function belongsTo(entry: Entry, personId: string | null): boolean {
  if (personId === null) return true;
  return entry.personIds.length === 0 || entry.personIds.includes(personId);
}

/** Wandelt eine Eingabe wie "12,99" oder "1.200" in Cent um. */
export function parseEuro(input: string): number | null {
  let s = input.replace(/[\s€]/g, "");
  if (s === "") return null;
  // Deutsches Format: Punkt als Tausendertrenner, Komma als Dezimaltrenner.
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

export function formatCents(cents: number): string {
  return euro.format(cents / 100);
}

/** Formatiert Cent für ein Eingabefeld, z. B. 1299 → "12,99". */
export function centsToInput(cents: number | null): string {
  if (cents === null) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function formatDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}.${m}.${y}` : iso;
}

export function categoryLabel(id: Category): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export function intervalLabel(id: Interval): string {
  return INTERVALS.find((i) => i.id === id)?.label ?? id;
}

export function deathActionLabel(id: DeathAction): string {
  return DEATH_ACTIONS.find((a) => a.id === id)?.label ?? id;
}

export function statusLabel(id: SettlementStatus): string {
  return SETTLEMENT_STATUS.find((s) => s.id === id)?.label ?? id;
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso.slice(0, 10));
  const to = Date.parse(toIso.slice(0, 10));
  return Math.round((to - from) / 86_400_000);
}

/** Einträge, deren Laufzeit in den nächsten `days` Tagen endet oder schon abgelaufen ist. */
export function upcomingEnds(entries: Entry[], todayIso: string, days: number): Entry[] {
  return entries
    .filter((e) => e.endDate && daysBetween(todayIso, e.endDate) <= days)
    .sort((a, b) => a.endDate.localeCompare(b.endDate));
}

/** Einträge, die nie oder vor mehr als `days` Tagen geprüft wurden. */
export function needsReview(entries: Entry[], todayIso: string, days = 365): Entry[] {
  return entries.filter((e) => !e.lastReviewed || daysBetween(e.lastReviewed, todayIso) > days);
}

export function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
