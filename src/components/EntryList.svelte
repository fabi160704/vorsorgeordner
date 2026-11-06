<script lang="ts">
  import {
    CATEGORIES,
    SETTLEMENT_STATUS,
    deathActionLabel,
    formatCents,
    intervalLabel,
    statusLabel,
    type Category,
    type Entry,
    type Person,
    type SettlementStatus,
  } from "../lib/model";

  interface Props {
    entries: Entry[];
    persons: Person[];
    showStatus: boolean;
    onedit: (entry: Entry) => void;
    onadd: () => void;
  }

  let { entries, persons, showStatus, onedit, onadd }: Props = $props();

  let search = $state("");
  let category = $state<Category | "">("");
  let status = $state<SettlementStatus | "">("");

  function matches(entry: Entry, query: string): boolean {
    if (!query) return true;
    const haystack = [entry.title, entry.provider, entry.reference, entry.notes, entry.storageLocation, entry.accessHint]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  }

  const filtered = $derived.by(() => {
    const query = search.trim().toLowerCase();
    return entries.filter(
      (e) =>
        matches(e, query) && (category === "" || e.category === category) && (!showStatus || status === "" || e.status === status),
    );
  });

  const groups = $derived(
    CATEGORIES.map((c) => ({
      ...c,
      entries: filtered.filter((e) => e.category === c.id).sort((a, b) => a.title.localeCompare(b.title, "de")),
    })).filter((g) => g.entries.length > 0),
  );

  function personNames(entry: Entry): string {
    if (entry.personIds.length === 0) return "alle";
    return entry.personIds
      .map((id) => persons.find((p) => p.id === id)?.name)
      .filter(Boolean)
      .join(", ");
  }
</script>

<div class="toolbar">
  <input type="search" placeholder="Suchen …" bind:value={search} />
  <select bind:value={category}>
    <option value="">Alle Kategorien</option>
    {#each CATEGORIES as c (c.id)}
      <option value={c.id}>{c.label}</option>
    {/each}
  </select>
  {#if showStatus}
    <select bind:value={status}>
      <option value="">Jeder Status</option>
      {#each SETTLEMENT_STATUS as s (s.id)}
        <option value={s.id}>{s.label}</option>
      {/each}
    </select>
  {/if}
  <button class="primary" onclick={onadd}>+ Eintrag</button>
</div>

{#if entries.length === 0}
  <div class="empty">
    <p>Noch keine Einträge.</p>
    <p class="muted">
      Typische Einträge: Krankenkasse, Haftpflicht, Girokonto, Rentenversicherung, Strom, Mobilfunk, Testament,
      Vorsorgevollmacht, Ablageort wichtiger Unterlagen.
    </p>
  </div>
{:else if filtered.length === 0}
  <p class="muted">Keine Einträge passen zum Filter.</p>
{/if}

{#each groups as group (group.id)}
  <h3>{group.label} <span class="count">{group.entries.length}</span></h3>
  <ul class="entries">
    {#each group.entries as entry (entry.id)}
      <li>
        <button class="entry" onclick={() => onedit(entry)}>
          <span class="main">
            <span class="name">{entry.title || "Ohne Bezeichnung"}</span>
            <span class="muted">
              {[entry.provider, entry.reference].filter(Boolean).join(" · ")}
            </span>
          </span>
          <span class="meta">
            {#if entry.costCents !== null}
              <span>{formatCents(entry.costCents)} {intervalLabel(entry.interval)}</span>
            {/if}
            <span class="muted">{personNames(entry)}</span>
          </span>
          <span class="death">
            {#if entry.deathAction}
              <span class="tag">{deathActionLabel(entry.deathAction)}</span>
            {/if}
            {#if showStatus}
              <span class="tag status-{entry.status}">{statusLabel(entry.status)}</span>
            {/if}
          </span>
        </button>
      </li>
    {/each}
  </ul>
{/each}

<style>
  .toolbar {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 8px;
  }
  .toolbar input {
    flex: 1;
    min-width: 180px;
  }
  .toolbar select {
    width: auto;
  }
  h3 {
    margin: 24px 0 8px;
    font-size: 1em;
  }
  .count {
    color: var(--muted);
    font-weight: normal;
  }
  .entries {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    background: var(--surface);
  }
  .entries li + li {
    border-top: 1px solid var(--border);
  }
  .entry {
    width: 100%;
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(0, 1.3fr) minmax(0, 220px);
    gap: 12px;
    align-items: center;
    text-align: left;
    border: none;
    border-radius: 0;
    background: none;
    padding: 10px 14px;
  }
  .entry:hover {
    background: var(--hover);
  }
  .main,
  .meta {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .main span,
  .meta span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .name {
    font-weight: 600;
  }
  .death {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: flex-end;
  }
  .empty {
    padding: 24px 0;
  }
  @media (max-width: 760px) {
    .entry {
      grid-template-columns: 1fr;
      gap: 4px;
    }
    .death {
      justify-content: flex-start;
    }
  }
</style>
