// Kalenderdatei (iCalendar, RFC 5545) mit Laufzeitenden und Kündigungsfristen.
//
// Die Datei enthält nur Bezeichnung, Anbieter und Fristen, keine Nummern,
// Kontakte oder Hinweise auf Zugangsdaten.

import { formatDate, type Entry } from "./model";

type Unit = "tag" | "woche" | "monat" | "jahr";

/** Liest die erste Angabe wie "3 Monate" oder "14 Tage" aus einer Kündigungsfrist. */
export function parseNoticePeriod(text: string): { amount: number; unit: Unit } | null {
  const match = /(\d+)\s*(tag|woche|monat|jahr)/i.exec(text);
  if (!match) return null;
  return { amount: Number(match[1]), unit: match[2].toLowerCase() as Unit };
}

/** Zieht einen Zeitraum von einem Datum ab. Monatsenden werden begrenzt (31.05. − 3 Monate = 28.02.). */
export function subtractPeriod(dateIso: string, amount: number, unit: Unit): string {
  const [y, m, d] = dateIso.slice(0, 10).split("-").map(Number);
  if (unit === "tag" || unit === "woche") {
    const date = new Date(Date.UTC(y, m - 1, d - amount * (unit === "woche" ? 7 : 1)));
    return date.toISOString().slice(0, 10);
  }
  const months = unit === "jahr" ? amount * 12 : amount;
  const target = new Date(Date.UTC(y, m - 1 - months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

function nextDay(dateIso: string): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Bricht Zeilen nach höchstens 75 Bytes um (RFC 5545, Abschnitt 3.1). */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74; // Folgezeilen beginnen mit einem Leerzeichen
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

interface CalendarEvent {
  uid: string;
  date: string;
  summary: string;
  description: string;
  alarmDays: number;
}

function label(entry: Entry): string {
  return entry.provider ? `${entry.title} (${entry.provider})` : entry.title;
}

/** Ereignisse für alle Einträge mit Laufzeitende ab `todayIso`, ohne bereits abgewickelte. */
export function calendarEvents(entries: Entry[], todayIso: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const entry of entries) {
    if (!entry.endDate || entry.status === "erledigt") continue;
    const details = [
      entry.noticePeriod && `Kündigungsfrist: ${entry.noticePeriod}`,
      entry.autoRenew && "Verlängert sich automatisch.",
    ].filter(Boolean);

    const notice = parseNoticePeriod(entry.noticePeriod);
    if (notice) {
      const date = subtractPeriod(entry.endDate, notice.amount, notice.unit);
      if (date >= todayIso) {
        events.push({
          uid: `${entry.id}-kuendigung@vorsorgeordner`,
          date,
          summary: `Kündigungsfrist endet: ${label(entry)}`,
          description: `Berechnet aus der Kündigungsfrist "${entry.noticePeriod}" und dem Laufzeitende ${formatDate(entry.endDate)}. Bitte im Vertrag prüfen.`,
          alarmDays: 14,
        });
      }
    }
    if (entry.endDate >= todayIso) {
      events.push({
        uid: `${entry.id}-ende@vorsorgeordner`,
        date: entry.endDate,
        summary: `Laufzeitende: ${label(entry)}`,
        description: details.join(" "),
        alarmDays: 7,
      });
    }
  }
  return events.sort((a, b) => a.date.localeCompare(b.date));
}

export function toIcs(entries: Entry[], now: Date): string {
  const todayIso = now.toISOString().slice(0, 10);
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Vorsorgeordner//DE", "CALSCALE:GREGORIAN"];
  for (const event of calendarEvents(entries, todayIso)) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${event.date.replace(/-/g, "")}`,
      `DTEND;VALUE=DATE:${nextDay(event.date).replace(/-/g, "")}`,
      `SUMMARY:${escapeText(event.summary)}`,
    );
    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(event.summary)}`,
      `TRIGGER:-P${event.alarmDays}D`,
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
