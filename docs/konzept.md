# Konzept

## Ausgangslage

Bei einem Todesfall müssen Angehörige in kurzer Zeit herausfinden, welche Verträge, Versicherungen, Konten und Mitgliedschaften es gibt, wo die Unterlagen liegen und wie man an Online-Zugänge kommt. Diese Suche ist zu diesem Zeitpunkt am schwierigsten, weil die Person selbst nicht mehr gefragt werden kann.

Der Vorsorgeordner soll diese Informationen vorher sammeln und aktuell halten. Er deckt drei Situationen ab:

1. Vorsorge: Man pflegt die eigenen Daten und die von Angehörigen und behält dabei laufende Kosten und Kündigungsfristen im Blick.
2. Notfall: Bei Krankheit oder Unfall finden Bevollmächtigte schnell Krankenkasse, Ärzte, Vollmachten und Konten.
3. Nachlass: Nach einem Todesfall wird jeder Eintrag zur Aufgabe mit Status (kündigen, umschreiben, Leistung beantragen, Tod melden).

## Anforderungen

- Läuft auf Windows, macOS und Linux. Smartphone ist optional.
- Mehrere Personen in einem Ordner, Einträge können mehreren Personen gehören.
- Sensible Daten sind verschlüsselt und bleiben lokal. Kein Server, kein Konto.
- Die Daten bleiben auch in vielen Jahren lesbar, auch wenn die App nicht mehr gepflegt wird.
- Angehörige kommen im Ernstfall an die Daten, ohne dass die App installiert sein muss.
- Geringer Aufwand für Betrieb und Pflege.

## Umsetzungsvarianten

| Variante | Vorteile | Nachteile |
| --- | --- | --- |
| Desktop-App mit Tauri (gewählt) | Kleine Installer (wenige MB) für alle drei Systeme, Daten lokal, Rust für Verschlüsselung, Tauri 2 kann später auch Android und iOS | Rust-Toolchain für die Entwicklung nötig |
| Desktop-App mit Electron | Großes Ökosystem, nur JavaScript | Installer über 100 MB, höherer Speicherverbrauch |
| Selbst gehostete Web-App (Docker, z. B. auf einem NAS) | Mehrere Familienmitglieder gleichzeitig, Zugriff von jedem Gerät | Server muss laufen und gewartet werden, im Todesfall kennt oft niemand den Server |
| Reine Browser-App (PWA) | Keine Installation | Daten im Browser-Speicher gehen leicht verloren, Dateizugriff je nach Browser eingeschränkt |
| Tabelle oder Notizvorlage (Excel, Notion, Obsidian) | Sofort nutzbar | Keine Fristen- und Kostenübersicht, Verschlüsselung und Abwicklungsstatus fehlen |

Tauri passt am besten zu den Anforderungen: Die App ist leicht, läuft lokal, und die Daten liegen in einer Datei, die man sichern, in einen Cloud-Ordner legen oder auf einen USB-Stick kopieren kann. Verwendet wird Tauri 2, die aktuelle stabile Version.

## Datenhaltung

Alle Daten stehen in einem JSON-Dokument, das mit age und einer Passphrase verschlüsselt in einer einzigen `.age`-Datei liegt. Details stehen in [datenformat.md](datenformat.md).

Gründe für diese Wahl:

- age ist ein offenes, dokumentiertes Format mit mehreren unabhängigen Implementierungen. Angehörige können die Datei mit dem Kommandozeilenwerkzeug `age` entschlüsseln, auch ohne diese App.
- JSON ist nach dem Entschlüsseln mit jedem Texteditor lesbar.
- Ein Vorsorgeordner umfasst einige hundert Einträge. Dafür ist keine Datenbank nötig, das ganze Dokument passt in den Arbeitsspeicher.
- Eine Datei lässt sich einfach sichern und weitergeben.

Eine SQLite-Datenbank mit SQLCipher wäre die Alternative. Sie lohnt sich erst bei großen Datenmengen oder vielen Anhängen und erschwert das Öffnen ohne App.

## Datenmodell

Ein Vorsorgeordner enthält Personen und Einträge. Jeder Eintrag hat eine Kategorie:

- Versicherungen (Haftpflicht, Hausrat, Leben, Unfall, Kfz)
- Banken und Konten (Girokonto, Depot, Kredit, Schließfach)
- Rente und Altersvorsorge
- Gesundheit (Krankenkasse, Pflegekasse, Ärzte)
- Verträge (Strom, Gas, Internet, Mobilfunk)
- Abos und Mitgliedschaften
- Wohnen und Immobilien
- Fahrzeuge
- Behörden und Steuern
- Digitale Konten (E-Mail, soziale Netzwerke, Cloud)
- Dokumente und Ablageorte (Testament, Vorsorgevollmacht, Patientenverfügung, Ausweise, Schlüssel)
- Wichtige Kontakte (Notar, Steuerberater, Hausarzt)
- Sonstiges

Alle Kategorien haben dieselben Felder. Nicht benötigte Felder bleiben leer. Das hält Formular und Datenformat einfach. Die Felder stehen in [datenformat.md](datenformat.md).

## Sicherheit

- Verschlüsselung mit age und scrypt. scrypt braucht beim Öffnen und Speichern bewusst etwa eine Sekunde, damit Passphrasen nicht schnell durchprobiert werden können.
- Die Passphrase bleibt nach dem Entsperren nur im Rust-Teil der App und wird beim Sperren verworfen.
- Gespeichert wird über eine temporäre Datei, die erst nach vollständigem Schreiben das Original ersetzt. Die vorige Version bleibt als `.bak` erhalten.
- Die App speichert keine Passwörter, sondern nur Hinweise, wo sie zu finden sind. Für Passwörter eignet sich ein Passwortmanager mit Notfallzugang, der Angehörigen nach einer Wartezeit Zugriff gibt.
- Nach einer einstellbaren Zeit ohne Eingabe (Standard 15 Minuten) speichert die App und sperrt sich.
- Beim Ändern der Passphrase wird auch die Sicherungskopie `.bak` neu verschlüsselt. Kopien außerhalb der App, etwa im Versionsverlauf eines Cloud-Ordners, bleiben mit der alten Passphrase lesbar.
- Exporte als JSON oder CSV sind unverschlüsselt. Die App warnt vorher und weigert sich, dabei eine verschlüsselte `.age`-Datei zu überschreiben.
- Die Oberfläche darf nur die eigenen Befehle und die Dateidialoge aufrufen (Tauri Capabilities, `src-tauri/capabilities/default.json`), und eine Content Security Policy verhindert das Nachladen fremder Inhalte.

Wenn die Passphrase verloren geht, sind die Daten nicht wiederherstellbar. Deshalb gehört die Passphrase auf Papier an einen Ort, den Angehörige im Ernstfall kennen, zum Beispiel in einen verschlossenen Umschlag bei der Vorsorgevollmacht. Zusätzlich hilft ein aktueller Ausdruck der Druckansicht im Ordner mit den Originaldokumenten.

## Zugriff für Angehörige

Damit der Vorsorgeordner im Ernstfall hilft, müssen Angehörige drei Dinge wissen:

1. Wo die Datei liegt (Rechner, Cloud-Ordner, USB-Stick).
2. Wie die Passphrase lautet oder wo sie hinterlegt ist.
3. Wie man die Datei öffnet: mit der App oder mit `age` (Anleitung in [datenformat.md](datenformat.md)).

Diese Angaben gehören in die Unterlagen, die Angehörige sicher finden, etwa zur Vorsorgevollmacht.

## Checkliste

Die Checkliste schlägt typische Einträge vor. Elf Punkte gelten für jede Person einzeln (Krankenversicherung, Hausarzt, Girokonto, Rentenversicherung, Finanzamt, Ausweise, Mobilfunk, E-Mail, Testament, Vorsorgevollmacht, Patientenverfügung), sechs für den Haushalt (Haftpflicht, Hausrat, Mietvertrag oder Grundbuch, Strom, Internet, Rundfunkbeitrag).

Ein Punkt gilt als erledigt, wenn ein Eintrag in einer passenden Kategorie existiert, dessen Bezeichnung oder Anbieter ein Stichwort enthält. Bei "Krankenversicherung" reicht also ein Eintrag "Krankenkasse" in der Kategorie Gesundheit. Einträge ohne Person zählen für alle Personen. Punkte, die nicht zutreffen, lassen sich ausblenden; das wird in der Datei gespeichert.

## Nächste Schritte

Umgesetzt in Version 0.2: Checkliste, Passphrase ändern, automatisches Sperren, Export als JSON und CSV.

Version 0.3:

- Anhänge wie gescannte Policen, verschlüsselt in der Datei oder in einem verschlüsselten Ordner daneben
- Erinnerungen an Kündigungsfristen, z. B. als Kalenderdatei (.ics)
- Nachlass-Ansicht als Aufgabenliste, sortiert nach Aktion und Dringlichkeit

Später:

- Zusätzlicher Notfallschlüssel: age erlaubt mehrere Empfänger. Neben der Passphrase könnte ein auf Papier gedruckter Schlüssel die Datei öffnen.
- Erkennen, wenn die Datei in einem Cloud-Ordner gleichzeitig von zwei Geräten geändert wurde
- Smartphone-Version zum Nachschlagen (Tauri 2 unterstützt Android und iOS)

## Offene Fragen

- Pflegt nur eine Person den Vorsorgeordner, oder sollen mehrere Familienmitglieder ihre Einträge selbst bearbeiten? Davon hängt ab, ob eine gemeinsame Datei reicht oder ob es eine Datei pro Person geben sollte.
- Wo soll die Datei liegen: nur lokal, in einem Cloud-Ordner oder auf einem NAS?
- Soll das Repository öffentlich sein, und wenn ja, unter welcher Lizenz?
- Der App-Bezeichner `de.vorsorgeordner.desktop` in `src-tauri/tauri.conf.json` ist ein Platzhalter und sollte vor der ersten Veröffentlichung auf eine eigene Domain geändert werden.
