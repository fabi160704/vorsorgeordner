# Datenformat

Diese Beschreibung ist auch für Angehörige gedacht, die die Datei öffnen müssen, wenn die App nicht mehr verfügbar ist.

## Datei

Ein Vorsorgeordner ist eine einzelne Datei mit der Endung `.age`. Sie ist im [age-Format v1](https://age-encryption.org/v1) mit einer Passphrase verschlüsselt (scrypt). Die Datei beginnt mit der Zeile `age-encryption.org/v1`.

Neben der Datei liegt nach dem ersten Speichern `<datei>.age.bak`. Das ist der Stand beim Öffnen der Datei in der letzten Sitzung, mit derselben Passphrase verschlüsselt.

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
  "settings": { "autoLockMinutes": 15 },
  "persons": [ ... ],
  "entries": [ ... ],
  "dismissedSuggestions": [ "hausrat", "testament:<Personen-ID>" ],
  "estateSteps": { "standesamt:<Personen-ID>": "erledigt" },
  "attachmentKey": "AGE-SECRET-KEY-1..."
}
```

Leere Felder sind leere Zeichenketten. Datumsangaben haben die Form `JJJJ-MM-TT`.

`settings.autoLockMinutes` ist die Zeit ohne Eingabe bis zum automatischen Sperren, `0` heißt nie. `settings.autoSave` schaltet das automatische Speichern ein (Standard) oder aus. `dismissedSuggestions` enthält die Punkte der Checkliste, die als "trifft nicht zu" markiert sind: die Kennung des Vorschlags (siehe `src/lib/checklist.ts`), bei Punkten für eine Person gefolgt von `:` und der Personen-ID. Beide Felder kamen mit Version 0.2 hinzu und fehlen in älteren Dateien.

`estateSteps` enthält den Stand der allgemeinen Schritte nach einem Todesfall (siehe `src/lib/estate.ts`), `attachmentKey` den Schlüssel für die Anhänge. Beide kamen mit Version 0.3 hinzu.

Der JSON-Export der App hat genau dieses Format, ist aber unverschlüsselt. Er enthält deshalb auch den Schlüssel für die Anhänge.

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
| `attachments` | Anhänge: Liste mit `id`, `name` (ursprünglicher Dateiname), `size` (Bytes) und `addedAt` |
| `createdAt`, `updatedAt` | Zeitstempel |

## Anhänge

Anhänge liegen im Ordner `<Dateiname>.anhaenge` neben der Datei, zum Beispiel `Vorsorgeordner.anhaenge` neben `Vorsorgeordner.age`. Jeder Anhang ist eine eigene Datei `<id>.age`. Den ursprünglichen Dateinamen findet man im JSON-Dokument unter `entries[].attachments[]`.

Die Anhänge sind nicht mit der Passphrase verschlüsselt, sondern mit dem Schlüssel aus `attachmentKey`. So öffnet man einen Anhang ohne die App:

1. Den Vorsorgeordner wie oben entschlüsseln.
2. Den Wert von `attachmentKey` (beginnt mit `AGE-SECRET-KEY-1`) in eine Textdatei `schluessel.txt` kopieren.
3. Den Anhang entschlüsseln:

```bash
age --decrypt -i schluessel.txt -o Police.pdf Vorsorgeordner.anhaenge/<id>.age
```

Getestet mit age 1.1.1. Die Datei `schluessel.txt` öffnet alle Anhänge und sollte danach gelöscht werden.

## Versionen

`formatVersion` steigt, wenn sich das Format so ändert, dass ältere App-Versionen die Datei nicht mehr richtig lesen. Neue optionale Felder erhöhen die Version nicht; die App ergänzt fehlende Felder beim Öffnen mit Standardwerten.
