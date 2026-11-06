// Abwicklung nach einem Todesfall: allgemeine erste Schritte und die
// Einträge der verstorbenen Person als Aufgabenliste.
//
// Die Fristen sind allgemeine Hinweise (Stand November 2026) und ersetzen
// keine Rechtsberatung.

import { belongsTo, type DeathAction, type Entry, type SettlementStatus, type Vault } from "./model";

export interface EstateStep {
  id: string;
  title: string;
  hint: string;
  /** Rechtsgrundlage oder Quelle der Frist. */
  source: string;
}

export const ESTATE_STEPS: EstateStep[] = [
  {
    id: "standesamt",
    title: "Tod beim Standesamt anzeigen, Sterbeurkunden beantragen",
    hint: "Spätestens am dritten Werktag nach dem Tod beim Standesamt des Sterbeorts. Häufig übernimmt das der Bestatter. Mehrere Sterbeurkunden beantragen, viele Stellen verlangen eine.",
    source: "§ 28 PStG",
  },
  {
    id: "bestattung",
    title: "Bestattung beauftragen",
    hint: "Wünsche zur Bestattung stehen gegebenenfalls in den Hinweisen zur Person. Die Fristen für die Bestattung regeln die Bundesländer.",
    source: "",
  },
  {
    id: "testament",
    title: "Testament beim Nachlassgericht abliefern",
    hint: "Ein Testament, das nicht amtlich verwahrt ist, muss unverzüglich beim Nachlassgericht abgegeben werden. Im Zweifel jedes Schriftstück abgeben, das ein Testament sein könnte.",
    source: "§ 2259 BGB",
  },
  {
    id: "sterbevierteljahr",
    title: "Vorschuss auf die Hinterbliebenenrente beantragen (Sterbevierteljahr)",
    hint: "Für Witwen und Witwer von Rentnern: innerhalb von 30 Tagen nach dem Tod beim Renten Service der Deutschen Post.",
    source: "Deutsche Rentenversicherung",
  },
  {
    id: "arbeitgeber",
    title: "Arbeitgeber oder Dienstherrn informieren",
    hint: "Falls die Person berufstätig war.",
    source: "",
  },
  {
    id: "erbschaft",
    title: "Über Annahme oder Ausschlagung der Erbschaft entscheiden",
    hint: "Ausschlagen ist nur binnen sechs Wochen möglich, gerechnet ab Kenntnis vom Erbfall und vom Grund der Berufung; bei einem Testament nicht vor dessen Bekanntgabe durch das Nachlassgericht. Lebte die verstorbene Person im Ausland oder ist der Erbe dort, gelten sechs Monate.",
    source: "§ 1944 BGB",
  },
  {
    id: "finanzamt",
    title: "Erbfall dem Finanzamt anzeigen",
    hint: "Binnen drei Monaten nach Kenntnis vom Erwerb. Entfällt unter anderem, wenn ein deutsches Gericht oder ein Notar das Testament eröffnet hat und kein Grundbesitz, Betriebsvermögen oder Auslandsvermögen dazugehört.",
    source: "§ 30 ErbStG",
  },
];

/** Reihenfolge nach Dringlichkeit: Meldungen und Leistungsanträge haben oft kurze Fristen. */
const ACTION_RANK: Record<DeathAction, number> = {
  melden: 0,
  leistung: 1,
  kuendigen: 2,
  umschreiben: 3,
  pruefen: 4,
  "": 5,
  keine: 6,
};

export function stepKey(stepId: string, personId: string): string {
  return `${stepId}:${personId}`;
}

export function stepStatus(vault: Vault, stepId: string, personId: string): SettlementStatus {
  return vault.estateSteps[stepKey(stepId, personId)] ?? "offen";
}

/**
 * Einträge, die bei der Abwicklung für eine verstorbene Person zu erledigen
 * sind. Einträge mit "nichts tun" fallen weg. Offene Aufgaben stehen oben,
 * sortiert nach Dringlichkeit der Aktion, erledigte unten.
 */
export function estateTasks(entries: Entry[], personId: string): Entry[] {
  return entries
    .filter((e) => belongsTo(e, personId) && e.deathAction !== "keine")
    .sort(
      (a, b) =>
        Number(a.status === "erledigt") - Number(b.status === "erledigt") ||
        ACTION_RANK[a.deathAction] - ACTION_RANK[b.deathAction] ||
        a.title.localeCompare(b.title, "de"),
    );
}

export function daysSince(fromIso: string, todayIso: string): number {
  return Math.round((Date.parse(todayIso.slice(0, 10)) - Date.parse(fromIso.slice(0, 10))) / 86_400_000);
}
