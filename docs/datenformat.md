# Datenformat

Diese Beschreibung ist auch für Angehörige gedacht, die die Datei öffnen müssen, wenn die App nicht mehr verfügbar ist.

## Datei

Ein Vorsorgeordner ist eine einzelne Datei mit der Endung `.age`. Sie ist im [age-Format v1](https://age-encryption.org/v1) mit einer Passphrase verschlüsselt (scrypt). Die Datei beginnt mit der Zeile `age-encryption.org/v1`.

Neben der Datei liegt nach dem ersten Speichern `<datei>.age.bak`. Das ist der Stand vor dem letzten Speichern, mit derselben Passphrase verschlüsselt.

## Ohne die App öffnen

Das Kommandozeilenwerkzeug `age` gibt es für Windows, macOS und Linux (https://github.com/FiloSottile/age, Paket `age` in den meisten Linux-Distributionen, `brew install age` unter macOS). Alternativ funktioniert `rage` (https://github.com/str4d/rage).

```bash
age --decrypt -o vorsorgeordner.json Vorsorgeordner.age
```

Das Werkzeug fragt nach der Passphrase und schreibt den Inhalt als JSON-Textdatei. Die entschlüsselte Datei enthält alle Daten im Klartext und sollte nach dem Lesen gelöscht werden.

Getestet mit age 1.1.1: Dateien der App lassen sich damit entschlüsseln, und mit `age --passphrase` verschlüsselte Dateien lassen sich in der App öffnen.

## Inhalt

Der entschlüsselte Inhalt ist ein JSON-Dokument:

```json
{
  "formatVersion": 1,
  "createdAt": "2026-11-06T10:00:00.000Z",
  "updatedAt": "2026-11-06T10:30:00.000Z",
  "persons": [ ... ],
  "entries": [ ... ]
}
```

Leere Felder sind leere Zeichenketten. Datumsangaben haben die Form `JJJJ-MM-TT`.

### Person

| Feld | Bedeutung |
| --- | --- |
| `id` | Kennung, auf die Einträge verweisen |
| `name` | Name |
| `birthDate` | Geburtsdatum |
| `deathDate` | Sterbedatum, leer solange die Person lebt |
| `notes` | Freie Hinweise, z. B. Wünsche, Haustiere, Ersatzschlüssel |

### Eintrag

| Feld | Bedeutung |
| --- | --- |
| `id` | Kennung |
| `category` | `versicherung`, `bank`, `vorsorge`, `gesundheit`, `vertrag`, `abo`, `wohnen`, `fahrzeug`, `behoerde`, `digital`, `dokument`, `kontakt` oder `sonstiges` |
| `title` | Bezeichnung, z. B. "Hausratversicherung" |
| `personIds` | Zugehörige Personen. Leer heißt: gilt für alle |
| `provider` | Anbieter oder Institution |
| `reference` | Vertrags-, Mitglieds-, Kunden- oder Versicherungsnummer |
| `contact` | Telefon, E-Mail, Adresse, Website |
| `costCents` | Betrag in Cent (1299 = 12,99 €), `null` wenn keine Kosten |
| `interval` | `monatlich`, `vierteljaehrlich`, `halbjaehrlich`, `jaehrlich` oder `einmalig` |
| `paymentMethod` | Zahlungsweg, z. B. Lastschrift von welchem Konto |
| `startDate`, `endDate` | Beginn und Ende bzw. nächster Ablauf |
| `noticePeriod` | Kündigungsfrist als Text |
| `autoRenew` | `true`, wenn sich der Vertrag automatisch verlängert |
| `accessHint` | Wo die Zugangsdaten liegen (keine Passwörter) |
| `storageLocation` | Wo die Unterlagen liegen |
| `deathAction` | Im Todesfall: `kuendigen`, `umschreiben`, `leistung` (Leistung beantragen), `melden`, `pruefen`, `keine` oder leer |
| `deathNotes` | Hinweise für den Todesfall |
| `status` | Stand der Abwicklung: `offen`, `in_bearbeitung`, `erledigt` |
| `statusNotes` | Notiz zur Abwicklung |
| `notes` | Freie Notizen |
| `lastReviewed` | Datum der letzten Prüfung |
| `createdAt`, `updatedAt` | Zeitstempel |

## Versionen

`formatVersion` steigt, wenn sich das Format so ändert, dass ältere App-Versionen die Datei nicht mehr richtig lesen. Neue optionale Felder erhöhen die Version nicht; die App ergänzt fehlende Felder beim Öffnen mit Standardwerten.
