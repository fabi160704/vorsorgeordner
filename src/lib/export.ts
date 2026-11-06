// Unverschlüsselte Exporte.

import {
  categoryLabel,
  centsToInput,
  deathActionLabel,
  formatDate,
  intervalLabel,
  serializeVault,
  statusLabel,
  type Entry,
  type Vault,
} from "./model";

export function toJson(vault: Vault): string {
  return serializeVault(vault);
}

const COLUMNS: [string, (e: Entry, names: (e: Entry) => string) => string][] = [
  ["Kategorie", (e) => categoryLabel(e.category)],
  ["Bezeichnung", (e) => e.title],
  ["Gehört zu", (e, names) => names(e)],
  ["Anbieter", (e) => e.provider],
  ["Nummer", (e) => e.reference],
  ["Kontakt", (e) => e.contact],
  ["Betrag (EUR)", (e) => centsToInput(e.costCents)],
  ["Intervall", (e) => (e.costCents === null ? "" : intervalLabel(e.interval))],
  ["Zahlungsweg", (e) => e.paymentMethod],
  ["Beginn", (e) => formatDate(e.startDate)],
  ["Ende", (e) => formatDate(e.endDate)],
  ["Kündigungsfrist", (e) => e.noticePeriod],
  ["Verlängert sich automatisch", (e) => (e.autoRenew ? "ja" : "")],
  ["Zugangsdaten", (e) => e.accessHint],
  ["Unterlagen", (e) => e.storageLocation],
  ["Im Todesfall", (e) => (e.deathAction ? deathActionLabel(e.deathAction) : "")],
  ["Hinweise Todesfall", (e) => e.deathNotes],
  ["Abwicklung", (e) => statusLabel(e.status)],
  ["Notiz Abwicklung", (e) => e.statusNotes],
  ["Notizen", (e) => e.notes],
  ["Zuletzt geprüft", (e) => formatDate(e.lastReviewed)],
];

function csvField(value: string): string {
  return /[";\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * CSV mit Semikolon als Trenner und BOM, damit Excel in deutscher Einstellung
 * Spalten und Umlaute richtig erkennt.
 */
export function toCsv(vault: Vault): string {
  const names = (e: Entry) =>
    e.personIds.length === 0
      ? "alle"
      : e.personIds
          .map((id) => vault.persons.find((p) => p.id === id)?.name ?? "")
          .filter(Boolean)
          .join(", ");
  const rows = [
    COLUMNS.map(([header]) => header),
    ...vault.entries.map((e) => COLUMNS.map(([, get]) => get(e, names))),
  ];
  return "﻿" + rows.map((row) => row.map(csvField).join(";")).join("\r\n") + "\r\n";
}
