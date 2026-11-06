<script lang="ts">
  import { onMount } from "svelte";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { backend, errorMessage } from "../lib/backend";
  import { store } from "../lib/state.svelte";
  import type { ChecklistItem } from "../lib/checklist";
  import { AUTO_SAVE_DELAY_MS, belongsTo, newEntry, newPerson, type Entry, type Person } from "../lib/model";
  import Checklist from "./Checklist.svelte";
  import Estate from "./Estate.svelte";
  import EntryForm from "./EntryForm.svelte";
  import EntryList from "./EntryList.svelte";
  import Overview from "./Overview.svelte";
  import PersonForm from "./PersonForm.svelte";
  import PrintView from "./PrintView.svelte";
  import SettingsDialog from "./SettingsDialog.svelte";

  type View = "eintraege" | "uebersicht" | "checkliste" | "abwicklung" | "druck";

  let view = $state<View>("eintraege");
  let selectedPersonId = $state<string | null>(null);
  let editingEntry = $state<Entry | null>(null);
  let editingPerson = $state<Person | null>(null);
  let settingsOpen = $state(false);

  const vault = $derived(store.vault!);
  const selectedPerson = $derived(vault.persons.find((p) => p.id === selectedPersonId) ?? null);
  const visibleEntries = $derived(vault.entries.filter((e) => belongsTo(e, selectedPersonId)));
  const fileName = $derived(store.path?.split(/[\\/]/).pop() ?? "");
  const deceased = $derived(
    selectedPerson ? (selectedPerson.deathDate ? [selectedPerson] : []) : vault.persons.filter((p) => p.deathDate),
  );
  // Ohne verstorbene Person gibt es keine Abwicklung; dann zurück zu den Einträgen.
  const activeView = $derived<View>(view === "abwicklung" && deceased.length === 0 ? "eintraege" : view);

  /** Speichert und gibt zurück, ob es geklappt hat. */
  async function save(): Promise<boolean> {
    try {
      await store.save();
      return true;
    } catch (err) {
      store.lastError = `Speichern fehlgeschlagen: ${errorMessage(err)}`;
      failedAtChange = store.changes;
      return false;
    }
  }

  /**
   * Vor dem Sperren oder Beenden: mit automatischem Speichern wird zuerst
   * gespeichert, sonst (oder wenn das scheitert) wird nachgefragt.
   */
  async function readyToLeave(action: string): Promise<boolean> {
    if (!store.dirty) return true;
    if (store.autoSave && (await save()) && !store.dirty) return true;
    return backend.confirm(`Es gibt ungespeicherte Änderungen. Trotzdem ${action}?`);
  }

  async function lock() {
    if (await readyToLeave("sperren")) await store.close();
  }

  // Automatisch speichern: einige Sekunden nach der letzten Änderung. Nach einem
  // Fehler wird erst bei der nächsten Änderung wieder versucht.
  let failedAtChange = $state(-1);
  $effect(() => {
    const changes = store.changes;
    if (!store.autoSave || !store.dirty || store.saving || changes === failedAtChange) return;
    const timer = setTimeout(save, AUTO_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  });

  function addEntry() {
    editingEntry = newEntry({ personIds: selectedPersonId ? [selectedPersonId] : [] });
  }

  function addFromChecklist(item: ChecklistItem) {
    editingEntry = newEntry({
      category: item.suggestion.category,
      title: item.suggestion.title,
      personIds: item.personId ? [item.personId] : [],
    });
  }

  // Automatisches Sperren: Jede Eingabe setzt die Zeit zurück.
  let lastActivity = Date.now();
  let autoLocking = false;

  function markActivity() {
    lastActivity = Date.now();
  }

  async function autoLock(minutes: number) {
    if (autoLocking) return;
    autoLocking = true;
    try {
      if (store.dirty) {
        try {
          await store.save();
        } catch (err) {
          store.lastError = `Automatisches Sperren nicht möglich, weil das Speichern fehlgeschlagen ist: ${errorMessage(err)}`;
          markActivity();
          return;
        }
      }
      await store.close(`Automatisch gesperrt nach ${minutes} Minuten ohne Eingabe.`);
    } finally {
      autoLocking = false;
    }
  }

  $effect(() => {
    const minutes = store.vault?.settings.autoLockMinutes ?? 0;
    if (!minutes) return;
    markActivity();
    const timer = setInterval(() => {
      if (Date.now() - lastActivity >= minutes * 60_000) autoLock(minutes);
    }, 5_000);
    return () => clearInterval(timer);
  });

  function onKeydown(event: KeyboardEvent) {
    markActivity();
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      save();
    }
  }

  onMount(() => {
    if (backend.isPreview) return;
    // Fenster nicht schließen, solange Änderungen ungespeichert sind.
    const unlisten = getCurrentWindow().onCloseRequested(async (event) => {
      if (!(await readyToLeave("beenden"))) event.preventDefault();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  });
</script>

<svelte:window onkeydown={onKeydown} onpointerdown={markActivity} onpointermove={markActivity} onwheel={markActivity} />

<div class="layout">
  <aside class="sidebar no-print">
    <div class="brand">Vorsorgeordner</div>
    <nav>
      <button class:active={selectedPersonId === null} onclick={() => (selectedPersonId = null)}>
        Alle Personen
      </button>
      {#each vault.persons as person (person.id)}
        <button class:active={selectedPersonId === person.id} onclick={() => (selectedPersonId = person.id)}>
          {person.name || "Ohne Namen"}
          {#if person.deathDate}<span class="tag">verstorben</span>{/if}
        </button>
      {/each}
    </nav>
    <button class="ghost" onclick={() => (editingPerson = newPerson())}>+ Person hinzufügen</button>
  </aside>

  <div class="main">
    <header class="topbar no-print">
      <div class="title">
        <h2>{selectedPerson?.name || "Alle Personen"}</h2>
        {#if selectedPerson}
          <button class="link" onclick={() => (editingPerson = selectedPerson)}>Person bearbeiten</button>
        {/if}
      </div>
      <div class="actions">
        <span class="file" title={store.path ?? ""}>
          {fileName}{#if store.saving}<span class="muted">{" · speichert …"}</span>{:else if store.dirty}<span class="dirty">{store.autoSave && store.changes !== failedAtChange ? " · wird gleich gespeichert" : " · ungespeichert"}</span>{:else if store.autoSave}<span class="muted">{" · gespeichert"}</span>{/if}
        </span>
        <button class="primary" onclick={save} disabled={!store.dirty || store.saving}>
          {store.saving ? "Speichert …" : "Speichern"}
        </button>
        <button onclick={() => (settingsOpen = true)}>Einstellungen</button>
        <button onclick={lock}>Sperren</button>
      </div>
    </header>

    {#if store.lastError}
      <p class="error banner no-print">{store.lastError}</p>
    {/if}
    {#if backend.isPreview}
      <p class="notice banner no-print">Browser-Vorschau: Änderungen werden nicht gespeichert.</p>
    {/if}

    <div class="views no-print" role="tablist">
      <button role="tab" aria-selected={activeView === "eintraege"} onclick={() => (view = "eintraege")}>Einträge</button>
      <button role="tab" aria-selected={activeView === "uebersicht"} onclick={() => (view = "uebersicht")}>Übersicht</button>
      <button role="tab" aria-selected={activeView === "checkliste"} onclick={() => (view = "checkliste")}>Checkliste</button>
      {#if deceased.length > 0}
        <button role="tab" aria-selected={activeView === "abwicklung"} onclick={() => (view = "abwicklung")}>Abwicklung</button>
      {/if}
      <button role="tab" aria-selected={activeView === "druck"} onclick={() => (view = "druck")}>Druckansicht</button>
    </div>

    <section class="content">
      {#if activeView === "eintraege"}
        <EntryList
          entries={visibleEntries}
          persons={vault.persons}
          showStatus={selectedPerson ? !!selectedPerson.deathDate : vault.persons.some((p) => p.deathDate)}
          onedit={(entry) => (editingEntry = entry)}
          onadd={addEntry}
        />
      {:else if activeView === "uebersicht"}
        <Overview entries={visibleEntries} persons={vault.persons} onedit={(entry) => (editingEntry = entry)} />
      {:else if activeView === "abwicklung"}
        <Estate
          {vault}
          {deceased}
          onedit={(entry) => (editingEntry = entry)}
          onentrystatus={(id, status, notes) => store.setEntryStatus(id, status, notes)}
          onstepstatus={(key, status) => store.setEstateStep(key, status)}
        />
      {:else if activeView === "checkliste"}
        <Checklist
          {vault}
          personId={selectedPersonId}
          onadd={addFromChecklist}
          onedit={(entry) => (editingEntry = entry)}
          ontoggle={(key) => store.toggleDismissed(key)}
        />
      {:else}
        <PrintView entries={visibleEntries} persons={vault.persons} person={selectedPerson} />
      {/if}
    </section>
  </div>
</div>

{#if editingEntry}
  {#key editingEntry.id}
    <EntryForm
      entry={editingEntry}
      isNew={!vault.entries.some((e) => e.id === editingEntry?.id)}
      persons={vault.persons}
      onsave={(entry) => {
        store.upsertEntry(entry);
        editingEntry = null;
      }}
      ondelete={(id) => {
        store.deleteEntry(id);
        editingEntry = null;
      }}
      onclose={() => (editingEntry = null)}
    />
  {/key}
{/if}

{#if settingsOpen}
  <SettingsDialog onclose={() => (settingsOpen = false)} />
{/if}

{#if editingPerson}
  {#key editingPerson.id}
    <PersonForm
      person={editingPerson}
      isNew={!vault.persons.some((p) => p.id === editingPerson?.id)}
      onsave={(person) => {
        store.upsertPerson(person);
        selectedPersonId = person.id;
        editingPerson = null;
      }}
      ondelete={(id) => {
        store.deletePerson(id);
        selectedPersonId = null;
        editingPerson = null;
      }}
      onclose={() => (editingPerson = null)}
    />
  {/key}
{/if}

<style>
  .layout {
    display: grid;
    grid-template-columns: 230px 1fr;
    min-height: 100vh;
  }
  .sidebar {
    background: var(--surface);
    border-right: 1px solid var(--border);
    padding: 16px 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .brand {
    font-weight: 700;
    padding: 4px 8px 8px;
  }
  nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  nav button {
    text-align: left;
    border: none;
    background: none;
    padding: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
  }
  nav button:hover {
    background: var(--hover);
  }
  nav button.active {
    background: var(--accent-soft);
    color: var(--accent);
    font-weight: 600;
  }
  .main {
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding: 14px 24px;
    border-bottom: 1px solid var(--border);
    flex-wrap: wrap;
  }
  .title {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }
  .title h2 {
    margin: 0;
  }
  .actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }
  .file {
    color: var(--muted);
    font-size: 0.9em;
    max-width: 280px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dirty {
    color: var(--warn);
  }
  .banner {
    margin: 12px 24px 0;
  }
  .views {
    display: flex;
    gap: 4px;
    padding: 12px 24px 0;
    border-bottom: 1px solid var(--border);
  }
  .views button {
    border: none;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    background: none;
    padding: 8px 12px;
  }
  .views button[aria-selected="true"] {
    border-bottom-color: var(--accent);
    color: var(--accent);
    font-weight: 600;
  }
  .content {
    padding: 20px 24px 40px;
  }
  @media (max-width: 760px) {
    .layout {
      grid-template-columns: 1fr;
    }
    .sidebar {
      border-right: none;
      border-bottom: 1px solid var(--border);
    }
  }
  @media print {
    .layout {
      display: block;
    }
    .content {
      padding: 0;
    }
  }
</style>
