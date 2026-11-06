// Checkliste typischer Einträge.
//
// Jeder Vorschlag gilt entweder für jede Person einzeln oder einmal für den
// ganzen Haushalt. Ein Vorschlag gilt als erledigt, wenn es einen Eintrag in
// einer passenden Kategorie gibt, dessen Bezeichnung oder Anbieter eines der
// Stichwörter enthält. Was nicht zutrifft, lässt sich ausblenden.

import { belongsTo, type Category, type Entry, type Person, type Vault } from "./model";

export interface Suggestion {
  id: string;
  title: string;
  /** Kategorie für einen neu angelegten Eintrag. */
  category: Category;
  /** Kategorien, in denen ein passender Eintrag gesucht wird. */
  matchCategories: Category[];
  keywords: string[];
  scope: "person" | "haushalt";
  hint: string;
}

export const SUGGESTIONS: Suggestion[] = [
  {
    id: "krankenversicherung",
    title: "Krankenversicherung",
    category: "gesundheit",
    matchCategories: ["gesundheit", "versicherung"],
    keywords: ["kranken"],
    scope: "person",
    hint: "Wird bei Krankheit und im Todesfall als Erstes gebraucht.",
  },
  {
    id: "hausarzt",
    title: "Hausarzt",
    category: "kontakt",
    matchCategories: ["kontakt", "gesundheit"],
    keywords: ["arzt", "ärztin", "praxis"],
    scope: "person",
    hint: "Kennt Vorerkrankungen und Medikamente.",
  },
  {
    id: "girokonto",
    title: "Girokonto",
    category: "bank",
    matchCategories: ["bank"],
    keywords: ["giro", "konto"],
    scope: "person",
    hint: "Über das Konto laufen die meisten Lastschriften.",
  },
  {
    id: "rente",
    title: "Rentenversicherung",
    category: "vorsorge",
    matchCategories: ["vorsorge"],
    keywords: ["rente", "renten"],
    scope: "person",
    hint: "Die Versicherungsnummer wird für Renten- und Hinterbliebenenanträge gebraucht.",
  },
  {
    id: "steuer",
    title: "Finanzamt und Steuer-ID",
    category: "behoerde",
    matchCategories: ["behoerde"],
    keywords: ["steuer", "finanzamt"],
    scope: "person",
    hint: "Steuer-ID, Steuernummer und zuständiges Finanzamt.",
  },
  {
    id: "ausweis",
    title: "Personalausweis und Reisepass",
    category: "dokument",
    matchCategories: ["dokument"],
    keywords: ["ausweis", "pass"],
    scope: "person",
    hint: "Wo die Ausweise liegen und wann sie ablaufen.",
  },
  {
    id: "mobilfunk",
    title: "Mobilfunkvertrag",
    category: "vertrag",
    matchCategories: ["vertrag"],
    keywords: ["mobil", "handy", "smartphone"],
    scope: "person",
    hint: "Die Telefonnummer ist oft auch zweiter Faktor für Online-Konten.",
  },
  {
    id: "email",
    title: "E-Mail-Konto",
    category: "digital",
    matchCategories: ["digital"],
    keywords: ["mail"],
    scope: "person",
    hint: "Über das E-Mail-Konto lassen sich die meisten anderen Zugänge zurücksetzen.",
  },
  {
    id: "testament",
    title: "Testament",
    category: "dokument",
    matchCategories: ["dokument"],
    keywords: ["testament", "erbvertrag"],
    scope: "person",
    hint: "Wo das Original liegt. Amtlich verwahrte Testamente sind im Zentralen Testamentsregister erfasst.",
  },
  {
    id: "vorsorgevollmacht",
    title: "Vorsorgevollmacht",
    category: "dokument",
    matchCategories: ["dokument"],
    keywords: ["vollmacht"],
    scope: "person",
    hint: "Lässt sich im Zentralen Vorsorgeregister der Bundesnotarkammer eintragen.",
  },
  {
    id: "patientenverfuegung",
    title: "Patientenverfügung",
    category: "dokument",
    matchCategories: ["dokument"],
    keywords: ["patientenverf"],
    scope: "person",
    hint: "Wo das Original liegt und wer eine Kopie hat.",
  },
  {
    id: "haftpflicht",
    title: "Privathaftpflicht",
    category: "versicherung",
    matchCategories: ["versicherung"],
    keywords: ["haftpflicht"],
    scope: "haushalt",
    hint: "",
  },
  {
    id: "hausrat",
    title: "Hausratversicherung",
    category: "versicherung",
    matchCategories: ["versicherung"],
    keywords: ["hausrat"],
    scope: "haushalt",
    hint: "",
  },
  {
    id: "wohnen",
    title: "Mietvertrag oder Grundbuch",
    category: "wohnen",
    matchCategories: ["wohnen"],
    keywords: ["miet", "grundbuch", "eigentum", "wohnung", "haus"],
    scope: "haushalt",
    hint: "Mietvertrag mit Vermieter und Kündigungsfrist, bei Eigentum der Grundbuchauszug.",
  },
  {
    id: "strom",
    title: "Strom",
    category: "vertrag",
    matchCategories: ["vertrag", "wohnen"],
    keywords: ["strom", "energie"],
    scope: "haushalt",
    hint: "",
  },
  {
    id: "internet",
    title: "Internet und Festnetz",
    category: "vertrag",
    matchCategories: ["vertrag"],
    keywords: ["internet", "dsl", "glasfaser", "kabel", "festnetz"],
    scope: "haushalt",
    hint: "",
  },
  {
    id: "rundfunk",
    title: "Rundfunkbeitrag",
    category: "behoerde",
    matchCategories: ["behoerde", "vertrag"],
    keywords: ["rundfunk", "beitragsservice", "gez"],
    scope: "haushalt",
    hint: "Beitragsnummer des Beitragsservice. Muss nach einem Todesfall abgemeldet oder umgemeldet werden.",
  },
];

export interface ChecklistItem {
  key: string;
  suggestion: Suggestion;
  /** Person, für die der Punkt gilt. null bei Haushaltspunkten. */
  personId: string | null;
  match: Entry | null;
  dismissed: boolean;
}

export interface ChecklistGroup {
  personId: string | null;
  label: string;
  items: ChecklistItem[];
}

export function suggestionKey(suggestion: Suggestion, personId: string | null): string {
  return personId ? `${suggestion.id}:${personId}` : suggestion.id;
}

function findMatch(suggestion: Suggestion, entries: Entry[], personId: string | null): Entry | null {
  return (
    entries.find(
      (e) =>
        suggestion.matchCategories.includes(e.category) &&
        belongsTo(e, personId) &&
        suggestion.keywords.some((k) => `${e.title} ${e.provider}`.toLowerCase().includes(k)),
    ) ?? null
  );
}

function item(vault: Vault, suggestion: Suggestion, personId: string | null): ChecklistItem {
  const key = suggestionKey(suggestion, personId);
  return {
    key,
    suggestion,
    personId,
    match: findMatch(suggestion, vault.entries, personId),
    dismissed: vault.dismissedSuggestions.includes(key),
  };
}

/**
 * Baut die Checkliste. Mit `personId` nur für diese Person (plus Haushalt),
 * sonst für alle Personen. Ohne Personen gelten alle Punkte für den Haushalt.
 */
export function buildChecklist(vault: Vault, personId: string | null): ChecklistGroup[] {
  const persons: Person[] = personId ? vault.persons.filter((p) => p.id === personId) : vault.persons;
  const personal = SUGGESTIONS.filter((s) => s.scope === "person");
  const household = SUGGESTIONS.filter((s) => s.scope === "haushalt");

  if (vault.persons.length === 0) {
    return [{ personId: null, label: "Haushalt", items: SUGGESTIONS.map((s) => item(vault, s, null)) }];
  }
  return [
    ...persons.map((p) => ({
      personId: p.id,
      label: p.name || "Ohne Namen",
      items: personal.map((s) => item(vault, s, p.id)),
    })),
    { personId: null, label: "Haushalt", items: household.map((s) => item(vault, s, null)) },
  ];
}

export function progress(groups: ChecklistGroup[]): { done: number; total: number } {
  const items = groups.flatMap((g) => g.items);
  return { done: items.filter((i) => i.match || i.dismissed).length, total: items.length };
}
