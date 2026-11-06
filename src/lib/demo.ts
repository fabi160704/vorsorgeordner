// Erfundene Beispieldaten für die Browser-Vorschau.

import { emptyVault, newEntry, newPerson, type Vault } from "./model";

export function demoVault(): Vault {
  const vault = emptyVault();
  const erika = newPerson({ name: "Erika Muster", birthDate: "1958-03-14", notes: "Hausschlüssel-Ersatz bei Nachbarin (Nr. 12)." });
  const max = newPerson({ name: "Max Muster", birthDate: "1955-09-02" });
  vault.persons.push(erika, max);

  vault.entries.push(
    newEntry({
      category: "gesundheit",
      title: "Krankenversicherung",
      personIds: [erika.id],
      provider: "Beispiel-Krankenkasse",
      reference: "Versichertennr. A123456789",
      contact: "Tel. 0800 000000",
      accessHint: "Online-Zugang: Passwortmanager, Eintrag 'Krankenkasse'",
      storageLocation: "Ordner 'Gesundheit', vorne",
      deathAction: "melden",
      lastReviewed: "2026-02-01",
    }),
    newEntry({
      category: "versicherung",
      title: "Privathaftpflicht",
      personIds: [],
      provider: "Muster Versicherung AG",
      reference: "PH-2020-4711",
      costCents: 8900,
      interval: "jaehrlich",
      paymentMethod: "Lastschrift Girokonto Musterbank",
      startDate: "2020-01-01",
      endDate: "2027-01-01",
      noticePeriod: "3 Monate zum Ablauf",
      autoRenew: true,
      storageLocation: "Ordner 'Versicherungen', Register 1",
      deathAction: "umschreiben",
      deathNotes: "Familientarif: auf überlebenden Partner umschreiben lassen.",
    }),
    newEntry({
      category: "versicherung",
      title: "Risikolebensversicherung",
      personIds: [max.id],
      provider: "Muster Leben AG",
      reference: "RL-998877",
      costCents: 2450,
      interval: "monatlich",
      startDate: "2010-05-01",
      endDate: "2030-05-01",
      storageLocation: "Ordner 'Versicherungen', Register 2",
      deathAction: "leistung",
      deathNotes: "Bezugsberechtigt: Erika. Sterbeurkunde und Police einreichen.",
    }),
    newEntry({
      category: "bank",
      title: "Girokonto",
      personIds: [erika.id, max.id],
      provider: "Musterbank",
      reference: "IBAN DE00 0000 0000 0000 0000 00",
      accessHint: "Banking-App, TAN-Gerät in der Schreibtischschublade",
      deathAction: "pruefen",
      deathNotes: "Gemeinschaftskonto, Vollmacht über den Tod hinaus vorhanden.",
    }),
    newEntry({
      category: "vertrag",
      title: "Strom",
      personIds: [max.id],
      provider: "Stadtwerke Musterstadt",
      reference: "Kundennr. 55 66 77",
      costCents: 9800,
      interval: "monatlich",
      endDate: "2026-12-31",
      noticePeriod: "1 Monat",
      deathAction: "umschreiben",
    }),
    newEntry({
      category: "abo",
      title: "Tageszeitung",
      personIds: [max.id],
      provider: "Musterstädter Anzeiger",
      costCents: 4290,
      interval: "monatlich",
      deathAction: "kuendigen",
    }),
    newEntry({
      category: "dokument",
      title: "Testament",
      personIds: [erika.id],
      storageLocation: "Original beim Amtsgericht hinterlegt, Kopie im Ordner 'Vorsorge'",
      notes: "Im Zentralen Testamentsregister registriert.",
    }),
    newEntry({
      category: "dokument",
      title: "Vorsorgevollmacht und Patientenverfügung",
      personIds: [erika.id],
      storageLocation: "Ordner 'Vorsorge', Register 1",
      notes: "Bevollmächtigt: Max. Im Zentralen Vorsorgeregister eingetragen.",
    }),
    newEntry({
      category: "kontakt",
      title: "Hausarzt",
      personIds: [],
      provider: "Praxis Dr. Beispiel",
      contact: "Tel. 01234 56789",
    }),
  );
  return vault;
}
