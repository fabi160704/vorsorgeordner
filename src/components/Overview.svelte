<script lang="ts">
  import {
    CATEGORIES,
    SETTLEMENT_STATUS,
    formatCents,
    formatDate,
    monthlyCents,
    needsReview,
    todayIso,
    upcomingEnds,
    yearlyCents,
    type Entry,
    type Person,
  } from "../lib/model";

  interface Props {
    entries: Entry[];
    persons: Person[];
    onedit: (entry: Entry) => void;
  }

  let { entries, persons, onedit }: Props = $props();

  const today = todayIso();

  const costRows = $derived(
    CATEGORIES.map((c) => {
      const inCategory = entries.filter((e) => e.category === c.id && yearlyCents(e) > 0);
      return {
        label: c.label,
        count: inCategory.length,
        monthly: inCategory.reduce((sum, e) => sum + monthlyCents(e), 0),
        yearly: inCategory.reduce((sum, e) => sum + yearlyCents(e), 0),
      };
    }).filter((r) => r.count > 0),
  );
  const totalMonthly = $derived(costRows.reduce((sum, r) => sum + r.monthly, 0));
  const totalYearly = $derived(costRows.reduce((sum, r) => sum + r.yearly, 0));

  const ending = $derived(upcomingEnds(entries, today, 120));
  const review = $derived(needsReview(entries, today));

  const deceasedIds = $derived(new Set(persons.filter((p) => p.deathDate).map((p) => p.id)));
  // Wie in der Liste: Einträge ohne Person gehören auch zum Nachlass.
  const settlementEntries = $derived(
    deceasedIds.size === 0
      ? []
      : entries.filter((e) => e.personIds.length === 0 || e.personIds.some((id) => deceasedIds.has(id))),
  );
  const settlementCounts = $derived(
    SETTLEMENT_STATUS.map((s) => ({ ...s, count: settlementEntries.filter((e) => e.status === s.id).length })),
  );
</script>

<div class="cards">
  <div class="card stat">
    <span class="muted">Laufende Kosten pro Monat</span>
    <strong>{formatCents(totalMonthly)}</strong>
  </div>
  <div class="card stat">
    <span class="muted">pro Jahr</span>
    <strong>{formatCents(totalYearly)}</strong>
  </div>
  <div class="card stat">
    <span class="muted">Einträge</span>
    <strong>{entries.length}</strong>
  </div>
</div>

{#if settlementEntries.length > 0}
  <h3>Abwicklung</h3>
  <div class="cards">
    {#each settlementCounts as s (s.id)}
      <div class="card stat">
        <span class="muted">{s.label}</span>
        <strong>{s.count}</strong>
      </div>
    {/each}
  </div>
{/if}

<h3>Kosten nach Kategorie</h3>
{#if costRows.length === 0}
  <p class="muted">Keine Einträge mit laufenden Kosten.</p>
{:else}
  <table>
    <thead>
      <tr><th>Kategorie</th><th class="num">Einträge</th><th class="num">pro Monat</th><th class="num">pro Jahr</th></tr>
    </thead>
    <tbody>
      {#each costRows as row (row.label)}
        <tr>
          <td>{row.label}</td>
          <td class="num">{row.count}</td>
          <td class="num">{formatCents(row.monthly)}</td>
          <td class="num">{formatCents(row.yearly)}</td>
        </tr>
      {/each}
    </tbody>
  </table>
  <p class="hint">Einträge, die mehreren Personen gehören, zählen einmal. Einmalige Kosten sind nicht enthalten.</p>
{/if}

<h3>Laufzeiten, die in den nächsten 4 Monaten enden</h3>
{#if ending.length === 0}
  <p class="muted">Keine.</p>
{:else}
  <ul class="plain">
    {#each ending as entry (entry.id)}
      <li>
        <button class="link" onclick={() => onedit(entry)}>{entry.title}</button>
        <span class="muted">
          {entry.endDate < today ? "abgelaufen am" : "endet am"}
          {formatDate(entry.endDate)}{#if entry.noticePeriod}, Kündigungsfrist: {entry.noticePeriod}{/if}
        </span>
      </li>
    {/each}
  </ul>
{/if}

<h3>Seit über einem Jahr nicht geprüft</h3>
{#if review.length === 0}
  <p class="muted">Alle Einträge sind aktuell.</p>
{:else}
  <ul class="plain">
    {#each review as entry (entry.id)}
      <li>
        <button class="link" onclick={() => onedit(entry)}>{entry.title}</button>
        <span class="muted">{entry.lastReviewed ? `zuletzt ${formatDate(entry.lastReviewed)}` : "nie geprüft"}</span>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
  }
  .stat {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .stat strong {
    font-size: 1.5em;
    font-variant-numeric: tabular-nums;
  }
  h3 {
    margin: 28px 0 10px;
    font-size: 1em;
  }
  .plain {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 6px;
  }
  .plain li {
    display: flex;
    gap: 10px;
    align-items: baseline;
    flex-wrap: wrap;
  }
</style>
