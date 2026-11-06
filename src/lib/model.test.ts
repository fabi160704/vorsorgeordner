import { describe, expect, it } from "vitest";
import {
  belongsTo,
  centsToInput,
  monthlyCents,
  needsReview,
  newEntry,
  parseEuro,
  parseVault,
  upcomingEnds,
  yearlyCents,
} from "./model";

describe("parseEuro", () => {
  it("liest deutsche Schreibweisen", () => {
    expect(parseEuro("12,99")).toBe(1299);
    expect(parseEuro("12,5 €")).toBe(1250);
    expect(parseEuro("1.234,56")).toBe(123456);
    expect(parseEuro("1.200")).toBe(120000);
    expect(parseEuro("12.99")).toBe(1299);
    expect(parseEuro("7")).toBe(700);
  });

  it("gibt null für leere oder ungültige Eingaben zurück", () => {
    expect(parseEuro("")).toBeNull();
    expect(parseEuro("  ")).toBeNull();
    expect(parseEuro("abc")).toBeNull();
    expect(parseEuro("1,234")).toBeNull();
  });

  it("passt zu centsToInput", () => {
    expect(parseEuro(centsToInput(4711))).toBe(4711);
  });
});

describe("Kosten", () => {
  it("rechnet Intervalle auf Jahr und Monat um", () => {
    expect(yearlyCents(newEntry({ costCents: 1000, interval: "monatlich" }))).toBe(12000);
    expect(yearlyCents(newEntry({ costCents: 3000, interval: "vierteljaehrlich" }))).toBe(12000);
    expect(monthlyCents(newEntry({ costCents: 12000, interval: "jaehrlich" }))).toBe(1000);
  });

  it("zählt einmalige und fehlende Kosten nicht als laufende Kosten", () => {
    expect(yearlyCents(newEntry({ costCents: 50000, interval: "einmalig" }))).toBe(0);
    expect(yearlyCents(newEntry({ costCents: null }))).toBe(0);
  });
});

describe("parseVault", () => {
  it("ergänzt fehlende Felder", () => {
    const vault = parseVault(
      JSON.stringify({ formatVersion: 1, persons: [{ id: "p1", name: "A" }], entries: [{ id: "e1", title: "X" }] }),
    );
    expect(vault.persons[0].deathDate).toBe("");
    expect(vault.entries[0].category).toBe("versicherung");
    expect(vault.entries[0].personIds).toEqual([]);
    expect(vault.entries[0].id).toBe("e1");
  });

  it("lehnt neuere Formatversionen ab", () => {
    expect(() => parseVault(JSON.stringify({ formatVersion: 99 }))).toThrow(/neueren Version/);
  });
});

describe("Filter", () => {
  it("ordnet Einträge ohne Person allen zu", () => {
    expect(belongsTo(newEntry({ personIds: [] }), "p1")).toBe(true);
    expect(belongsTo(newEntry({ personIds: ["p2"] }), "p1")).toBe(false);
    expect(belongsTo(newEntry({ personIds: ["p2"] }), null)).toBe(true);
  });

  it("findet bald endende Laufzeiten", () => {
    const entries = [
      newEntry({ title: "bald", endDate: "2026-12-01" }),
      newEntry({ title: "später", endDate: "2027-12-01" }),
      newEntry({ title: "abgelaufen", endDate: "2026-01-01" }),
      newEntry({ title: "ohne" }),
    ];
    expect(upcomingEnds(entries, "2026-11-06", 90).map((e) => e.title)).toEqual(["abgelaufen", "bald"]);
  });

  it("findet Einträge, die geprüft werden sollten", () => {
    const entries = [
      newEntry({ title: "nie" }),
      newEntry({ title: "alt", lastReviewed: "2025-01-01" }),
      newEntry({ title: "frisch", lastReviewed: "2026-10-01" }),
    ];
    expect(needsReview(entries, "2026-11-06").map((e) => e.title)).toEqual(["nie", "alt"]);
  });
});
