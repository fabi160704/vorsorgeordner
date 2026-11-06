# Vorsorgeordner

Desktop-App für Windows, macOS und Linux. Man hält darin für sich und Angehörige fest, welche Verträge, Versicherungen, Konten und Mitgliedschaften es gibt, was sie kosten, wie lange sie laufen, wo Unterlagen und Zugangsdaten zu finden sind und was im Todesfall zu tun ist.

Alle Daten liegen verschlüsselt in einer einzigen Datei. Die Datei verwendet das offene [age-Format](https://age-encryption.org/v1) und lässt sich deshalb auch ohne diese App öffnen (siehe [docs/datenformat.md](docs/datenformat.md)).

## Stand

Version 0.3:

- Vorsorgeordner-Datei anlegen und mit Passphrase entsperren
- Personen verwalten, mit Geburts- und Sterbedatum und freien Hinweisen
- Einträge in 13 Kategorien, von Versicherungen über digitale Konten bis zu Ablageorten wichtiger Dokumente
- Pro Eintrag: Anbieter, Vertrags- oder Mitgliedsnummer, Kontakt, Betrag und Intervall, Zahlungsweg, Laufzeit, Kündigungsfrist, Hinweis auf Zugangsdaten, Ablageort der Unterlagen, Aktion im Todesfall, Prüfdatum
- Abwicklungsstatus (offen, in Bearbeitung, erledigt), sobald für eine Person ein Sterbedatum eingetragen ist
- Übersicht mit laufenden Kosten pro Monat und Jahr, bald endenden Laufzeiten und lange nicht geprüften Einträgen
- Checkliste typischer Einträge pro Person und für den Haushalt, die zeigt, was noch fehlt
- Druckansicht, die sich über den Druckdialog auch als PDF speichern lässt
- Export als unverschlüsseltes JSON (alle Daten) oder CSV (Tabelle für Excel)
- Passphrase ändern
- Automatisches Sperren nach einstellbarer Zeit ohne Eingabe, vorher wird gespeichert
- Anhänge wie gescannte Policen, verschlüsselt in einem Ordner neben der Datei
- Abwicklung nach einem Todesfall als Aufgabenliste: allgemeine erste Schritte mit Fristen und die Einträge der Person, sortiert nach Dringlichkeit
- Laufzeitenden und Kündigungsfristen als Kalenderdatei (.ics)

Konzept, Varianten und nächste Schritte stehen in [docs/konzept.md](docs/konzept.md).

## Entwicklung

Voraussetzungen sind Node.js 22 oder neuer, Rust 1.90 oder neuer und die [Systemabhängigkeiten von Tauri](https://v2.tauri.app/start/prerequisites/) für das jeweilige Betriebssystem.

```bash
npm install
```

Desktop-App im Entwicklungsmodus starten:

```bash
npm run tauri dev
```

Nur die Oberfläche im Browser starten, mit Beispieldaten und ohne Speichern. Dafür ist kein Rust nötig:

```bash
npm run dev
```

Danach ist die Vorschau unter http://localhost:1420 erreichbar.

Tests und Typprüfung:

```bash
npm test
```

```bash
npm run check
```

```bash
cd src-tauri && cargo test
```

Installer für das aktuelle Betriebssystem bauen (Ergebnis unter `src-tauri/target/release/bundle/`):

```bash
npm run tauri build
```

Installer für alle drei Betriebssysteme baut der GitHub-Workflow in `.github/workflows/build.yml`, sobald ein Tag wie `v0.3.0` gepusht wird.

## Aufbau

```text
src/                    Oberfläche (Svelte 5, TypeScript)
  lib/model.ts          Datenmodell, Kategorien, Kostenberechnung
  lib/checklist.ts      Checkliste typischer Einträge
  lib/export.ts         Export als JSON und CSV
  lib/estate.ts         Schritte und Aufgaben für die Abwicklung
  lib/ics.ts            Kalenderdatei mit Fristen
  lib/state.svelte.ts   Zustand der geöffneten Datei
  lib/backend.ts        Aufrufe an den Rust-Teil, Browser-Vorschau
  components/           Ansichten und Formulare
src-tauri/              Desktop-Hülle (Tauri 2, Rust)
  src/vault.rs          Verschlüsselung (age/scrypt) und sicheres Speichern
  src/attachments.rs    Verschlüsselte Anhänge
  src/lib.rs            Befehle, die die Oberfläche aufrufen kann
docs/                   Konzept und Datenformat
```

## Sicherheit in Kürze

- Die Datei ist mit der Passphrase verschlüsselt. Ohne Passphrase kommt niemand an die Daten, auch nicht Angehörige. Die Passphrase sollte deshalb auf Papier hinterlegt werden, zum Beispiel bei Testament oder Vorsorgevollmacht.
- Die App speichert Hinweise, wo Zugangsdaten liegen, aber keine Passwörter. Passwörter gehören in einen Passwortmanager mit Notfallzugang.
- Beim Speichern bleibt die vorherige Version als `<datei>.age.bak` erhalten.
- Nach 15 Minuten ohne Eingabe sperrt sich die App. Die Zeit lässt sich in den Einstellungen ändern.
- Exporte sind unverschlüsselt. Die App warnt davor und überschreibt dabei nie eine `.age`-Datei.
- Anhänge liegen verschlüsselt im Ordner `<Dateiname>.anhaenge` neben der Datei. Beim Sichern beides kopieren.
- `*.age`-Dateien sind per `.gitignore` vom Repository ausgeschlossen.

Das App-Symbol entsteht aus `app-icon.svg` mit `npx tauri icon app-icon.svg -o src-tauri/icons`.
