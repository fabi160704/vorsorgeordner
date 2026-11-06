import { describe, expect, it } from "vitest";
import { newEntry } from "./model";
import { store } from "./state.svelte";

describe("Speichern", () => {
  it("bleibt ungespeichert, wenn während des Speicherns geändert wird", async () => {
    await store.open("Beispiel.age", "egal");
    expect(store.dirty).toBe(false);

    store.upsertEntry(newEntry({ title: "Erste Änderung" }));
    expect(store.dirty).toBe(true);
    const before = store.changes;

    const saving = store.save();
    store.upsertEntry(newEntry({ title: "Während des Speicherns" }));
    await saving;
    expect(store.changes).toBe(before + 1);
    expect(store.dirty).toBe(true);

    await store.save();
    expect(store.dirty).toBe(false);
  });

  it("speichert die Einstellung für automatisches Speichern in der Datei", async () => {
    await store.open("Beispiel.age", "egal");
    expect(store.autoSave).toBe(true);
    store.setAutoSave(false);
    expect(store.vault?.settings.autoSave).toBe(false);
    expect(store.dirty).toBe(true);
  });
});
