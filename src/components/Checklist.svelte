<script lang="ts">
  import { buildChecklist, progress, type ChecklistItem } from "../lib/checklist";
  import { categoryLabel, type Entry, type Vault } from "../lib/model";

  interface Props {
    vault: Vault;
    personId: string | null;
    onadd: (item: ChecklistItem) => void;
    onedit: (entry: Entry) => void;
    ontoggle: (key: string) => void;
  }

  let { vault, personId, onadd, onedit, ontoggle }: Props = $props();

  let showDone = $state(false);

  const groups = $derived(buildChecklist(vault, personId));
  const stats = $derived(progress(groups));
  const percent = $derived(stats.total === 0 ? 100 : Math.round((stats.done / stats.total) * 100));
</script>

<div class="head">
  <div class="progress">
    <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax={stats.total} aria-valuenow={stats.done}>
      <span style:width="{percent}%"></span>
    </div>
    <span class="muted">{stats.done} von {stats.total} Punkten erledigt</span>
  </div>
  <label class="check">
    <input type="checkbox" bind:checked={showDone} />
    Erledigte anzeigen
  </label>
</div>

<p class="hint">
  Typische Einträge, die im Notfall oder Todesfall gebraucht werden. Ein Punkt gilt als erledigt, sobald es einen
  passenden Eintrag gibt. Was nicht zutrifft, lässt sich ausblenden.
</p>

{#each groups as group (group.personId ?? "haushalt")}
  {@const open = group.items.filter((i) => !i.match && !i.dismissed)}
  {@const shown = showDone ? group.items : open}
  <h3>{group.label} <span class="count">{group.items.length - open.length}/{group.items.length}</span></h3>
  {#if shown.length === 0}
    <p class="muted">Alles erledigt.</p>
  {:else}
    <ul class="items">
      {#each shown as item (item.key)}
        <li class:done={item.match || item.dismissed}>
          <span class="state">
            {#if item.match}
              <span class="tag status-erledigt">vorhanden</span>
            {:else if item.dismissed}
              <span class="tag">trifft nicht zu</span>
            {:else}
              <span class="tag status-in_bearbeitung">fehlt</span>
            {/if}
          </span>
          <span class="text">
            <span class="name">{item.suggestion.title}</span>
            <span class="muted">
              {categoryLabel(item.suggestion.category)}{#if item.suggestion.hint}{` · ${item.suggestion.hint}`}{/if}
            </span>
          </span>
          <span class="buttons">
            {#if item.match}
              <button onclick={() => item.match && onedit(item.match)}>Öffnen</button>
            {:else if item.dismissed}
              <button onclick={() => ontoggle(item.key)}>Wieder anzeigen</button>
            {:else}
              <button class="primary" onclick={() => onadd(item)}>Anlegen</button>
              <button onclick={() => ontoggle(item.key)}>Trifft nicht zu</button>
            {/if}
          </span>
        </li>
      {/each}
    </ul>
  {/if}
{/each}

<style>
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }
  .progress {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 260px;
  }
  .bar {
    flex: 1;
    max-width: 320px;
    height: 8px;
    border-radius: 999px;
    background: var(--hover);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--accent);
  }
  .hint {
    margin: 10px 0 0;
  }
  h3 {
    margin: 24px 0 8px;
    font-size: 1em;
  }
  .count {
    color: var(--muted);
    font-weight: normal;
  }
  .items {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
  }
  .items li {
    display: grid;
    grid-template-columns: 96px minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    padding: 10px 14px;
  }
  .items li + li {
    border-top: 1px solid var(--border);
  }
  .items li.done .name {
    color: var(--muted);
  }
  .text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .name {
    font-weight: 600;
  }
  .buttons {
    display: flex;
    gap: 6px;
    justify-content: flex-end;
  }
  @media (max-width: 760px) {
    .items li {
      grid-template-columns: 1fr;
      gap: 6px;
    }
    .buttons {
      justify-content: flex-start;
    }
  }
</style>
