import { describe, expect, it } from "vitest";
import { buildChecklist, progress, SUGGESTIONS, suggestionKey } from "./checklist";
import { toCsv } from "./export";
import { emptyVault, newEntry, newPerson, parseVault, serializeVault } from "./model";

function vaultWithTwoPersons() {
  const vault = emptyVault();
  const a = newPerson({ id: "a", name: "Anna" });
  const b = newPerson({ id: "b", name: "Ben" });
  vault.persons.push(a, b);
  return vault;
}

describe("Checkliste", () => {
  it("erkennt vorhandene Einträge pro Person", () => {
    const vault = vaultWithTwoPersons();
    vault.entries.push(newEntry({ category: "gesundheit", title: "Krankenkasse", personIds: ["a"] }));

    const [anna, ben] = buildChecklist(vault, null);
    const kranken = (items: typeof anna.items) => items.find((i) => i.suggestion.id === "krankenversicherung")!;
    expect(kranken(anna.items).match?.title).toBe("Krankenkasse");
    expect(kranken(ben.items).match).toBeNull();
  });

  it("zählt Einträge ohne Person für alle", () => {
    const vault = vaultWithTwoPersons();
    vault.entries.push(newEntry({ category: "bank", title: "Gemeinsames Girokonto", personIds: [] }));
    const groups = buildChecklist(vault, null);
    for (const g of groups.filter((g) => g.personId)) {
      expect(g.items.find((i) => i.suggestion.id === "girokonto")?.match).not.toBeNull();
    }
  });

  it("verlangt eine passende Kategorie", () => {
    const vault = vaultWithTwoPersons();
    vault.entries.push(newEntry({ category: "sonstiges", title: "Testament", personIds: ["a"] }));
    const [anna] = buildChecklist(vault, "a");
    expect(anna.items.find((i) => i.suggestion.id === "testament")?.match).toBeNull();
  });

  it("filtert auf eine Person und hängt den Haushalt an", () => {
    const groups = buildChecklist(vaultWithTwoPersons(), "b");
    expect(groups.map((g) => g.label)).toEqual(["Ben", "Haushalt"]);
  });

  it("erkennt einen aus dem Vorschlag angelegten Eintrag als erledigt", () => {
    for (const suggestion of SUGGESTIONS) {
      const vault = emptyVault();
      vault.entries.push(newEntry({ category: suggestion.category, title: suggestion.title }));
      const item = buildChecklist(vault, null)[0].items.find((i) => i.suggestion.id === suggestion.id);
      expect(item?.match, suggestion.id).not.toBeNull();
    }
  });

  it("gilt ohne Personen komplett für den Haushalt", () => {
    const groups = buildChecklist(emptyVault(), null);
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(SUGGESTIONS.length);
  });

  it("berücksichtigt ausgeblendete Punkte im Fortschritt", () => {
    const vault = vaultWithTwoPersons();
    const testament = SUGGESTIONS.find((s) => s.id === "testament")!;
    vault.dismissedSuggestions.push(suggestionKey(testament, "a"));
    const groups = buildChecklist(vault, "a");
    expect(groups[0].items.find((i) => i.suggestion.id === "testament")?.dismissed).toBe(true);
    expect(progress(groups).done).toBe(1);
  });

  it("überlebt Speichern und Laden", () => {
    const vault = vaultWithTwoPersons();
    vault.dismissedSuggestions.push("hausrat");
    vault.settings.autoLockMinutes = 5;
    const loaded = parseVault(serializeVault(vault));
    expect(loaded.dismissedSuggestions).toEqual(["hausrat"]);
    expect(loaded.settings.autoLockMinutes).toBe(5);
  });

  it("ergänzt Standardwerte für Dateien aus Version 0.1", () => {
    const loaded = parseVault(JSON.stringify({ formatVersion: 1, persons: [], entries: [] }));
    expect(loaded.dismissedSuggestions).toEqual([]);
    expect(loaded.settings.autoLockMinutes).toBe(15);
  });
});

describe("CSV-Export", () => {
  it("schreibt Kopfzeile, Werte und maskiert Sonderzeichen", () => {
    const vault = vaultWithTwoPersons();
    vault.entries.push(
      newEntry({
        category: "versicherung",
        title: 'Haftpflicht "Familie"',
        personIds: [],
        costCents: 8950,
        interval: "jaehrlich",
        notes: "Zeile 1\nZeile 2; mit Semikolon",
        endDate: "2027-01-01",
      }),
    );
    const csv = toCsv(vault);
    expect(csv.startsWith("﻿Kategorie;Bezeichnung;")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('Versicherungen;"Haftpflicht ""Familie""";alle;');
    expect(lines[1]).toContain(";89,50;jährlich;");
    expect(lines[1]).toContain(";01.01.2027;");
    expect(lines[1]).toContain('"Zeile 1\nZeile 2; mit Semikolon"');
  });
});
