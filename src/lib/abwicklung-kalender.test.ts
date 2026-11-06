import { describe, expect, it } from "vitest";
import { estateTasks, ESTATE_STEPS, stepKey, stepStatus, daysSince } from "./estate";
import { calendarEvents, foldLine, parseNoticePeriod, subtractPeriod, toIcs } from "./ics";
import { emptyVault, newEntry, parseVault, serializeVault } from "./model";

describe("Abwicklung", () => {
  it("sortiert offene Aufgaben nach Dringlichkeit und erledigte nach unten", () => {
    const entries = [
      newEntry({ title: "Zeitung", deathAction: "kuendigen", personIds: ["p"] }),
      newEntry({ title: "Leben", deathAction: "leistung", personIds: ["p"], status: "erledigt" }),
      newEntry({ title: "Krankenkasse", deathAction: "melden", personIds: ["p"] }),
      newEntry({ title: "Unklar", deathAction: "", personIds: ["p"] }),
      newEntry({ title: "Egal", deathAction: "keine", personIds: ["p"] }),
      newEntry({ title: "Fremd", deathAction: "melden", personIds: ["q"] }),
      newEntry({ title: "Haftpflicht", deathAction: "umschreiben", personIds: [] }),
    ];
    expect(estateTasks(entries, "p").map((e) => e.title)).toEqual([
      "Krankenkasse",
      "Zeitung",
      "Haftpflicht",
      "Unklar",
      "Leben",
    ]);
  });

  it("speichert den Stand der Schritte pro Person", () => {
    const vault = emptyVault();
    vault.estateSteps[stepKey("standesamt", "p")] = "erledigt";
    const loaded = parseVault(serializeVault(vault));
    expect(stepStatus(loaded, "standesamt", "p")).toBe("erledigt");
    expect(stepStatus(loaded, "standesamt", "q")).toBe("offen");
    expect(stepStatus(loaded, "testament", "p")).toBe("offen");
  });

  it("verwirft ungültige Werte beim Laden", () => {
    const loaded = parseVault(JSON.stringify({ estateSteps: { "a:p": "erledigt", "b:p": "quatsch" } }));
    expect(loaded.estateSteps).toEqual({ "a:p": "erledigt" });
  });

  it("hat eindeutige Schritte mit Quellen für Fristen", () => {
    expect(new Set(ESTATE_STEPS.map((s) => s.id)).size).toBe(ESTATE_STEPS.length);
    for (const step of ESTATE_STEPS.filter((s) => /Tag|Woche|Monat/.test(s.hint))) {
      expect(step.source, step.id).not.toBe("");
    }
  });

  it("zählt Tage seit dem Tod", () => {
    expect(daysSince("2026-10-20", "2026-11-06")).toBe(17);
  });
});

describe("Kalenderdatei", () => {
  it("liest Kündigungsfristen", () => {
    expect(parseNoticePeriod("3 Monate zum Ablauf")).toEqual({ amount: 3, unit: "monat" });
    expect(parseNoticePeriod("14 Tage")).toEqual({ amount: 14, unit: "tag" });
    expect(parseNoticePeriod("6 Wochen zum Quartalsende")).toEqual({ amount: 6, unit: "woche" });
    expect(parseNoticePeriod("jederzeit")).toBeNull();
  });

  it("rechnet Fristen zurück und begrenzt Monatsenden", () => {
    expect(subtractPeriod("2027-01-01", 3, "monat")).toBe("2026-10-01");
    expect(subtractPeriod("2027-05-31", 3, "monat")).toBe("2027-02-28");
    expect(subtractPeriod("2027-01-10", 2, "woche")).toBe("2026-12-27");
    expect(subtractPeriod("2027-03-01", 1, "jahr")).toBe("2026-03-01");
  });

  it("erzeugt Ereignisse für Kündigungsfrist und Laufzeitende", () => {
    const entries = [
      newEntry({ id: "a", title: "Haftpflicht", provider: "Muster AG", endDate: "2027-01-01", noticePeriod: "3 Monate" }),
      newEntry({ id: "b", title: "Strom", endDate: "2026-12-31", noticePeriod: "1 Monat" }),
      newEntry({ id: "c", title: "Alt", endDate: "2026-01-01" }),
      newEntry({ id: "d", title: "Erledigt", endDate: "2027-06-01", status: "erledigt" }),
    ];
    // Kündigungsfrist der Haftpflicht (01.10.2026) liegt vor dem 06.11.2026 und entfällt.
    expect(calendarEvents(entries, "2026-11-06").map((e) => `${e.date} ${e.summary}`)).toEqual([
      "2026-11-30 Kündigungsfrist endet: Strom",
      "2026-12-31 Laufzeitende: Strom",
      "2027-01-01 Laufzeitende: Haftpflicht (Muster AG)",
    ]);
  });

  it("schreibt gültiges iCalendar mit Maskierung und Zeilenumbruch", () => {
    const ics = toIcs(
      [newEntry({ id: "x", title: "Sehr, sehr; langer Titel ".repeat(4), endDate: "2027-02-01", noticePeriod: "1 Monat" })],
      new Date("2026-11-06T10:00:00Z"),
    );
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART;VALUE=DATE:20270101");
    expect(ics).toContain("DTEND;VALUE=DATE:20270102");
    expect(ics).toContain("DTSTAMP:20261106T100000Z");
    expect(ics).toContain("Sehr\\, sehr\\; langer");
    for (const line of ics.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });

  it("bricht Umlaute nicht mitten im Zeichen um", () => {
    const folded = foldLine("SUMMARY:" + "ä".repeat(60));
    expect(folded.split("\r\n ").join("")).toBe("SUMMARY:" + "ä".repeat(60));
  });
});

describe("Anhänge im Datenmodell", () => {
  it("bleiben beim Speichern erhalten und fehlen in alten Dateien nicht", () => {
    const vault = emptyVault();
    vault.attachmentKey = "AGE-SECRET-KEY-1TEST";
    vault.entries.push(newEntry({ attachments: [{ id: "a", name: "Police.pdf", size: 10, addedAt: "2026-11-06" }] }));
    const loaded = parseVault(serializeVault(vault));
    expect(loaded.attachmentKey).toBe("AGE-SECRET-KEY-1TEST");
    expect(loaded.entries[0].attachments[0].name).toBe("Police.pdf");

    const old = parseVault(JSON.stringify({ entries: [{ id: "e", title: "Alt", attachments: "kaputt" }] }));
    expect(old.entries[0].attachments).toEqual([]);
    expect(old.attachmentKey).toBe("");
  });
});
