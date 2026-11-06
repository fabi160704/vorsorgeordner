<script lang="ts">
  import { backend, errorMessage } from "../lib/backend";
  import {
    CATEGORIES,
    deathActionLabel,
    formatCents,
    formatDate,
    intervalLabel,
    statusLabel,
    type Entry,
    type Person,
  } from "../lib/model";

  interface Props {
    entries: Entry[];
    persons: Person[];
    person: Person | null;
  }

  let { entries, persons, person }: Props = $props();

  let error = $state<string | null>(null);

  const shownPersons = $derived(person ? [person] : persons);
  const groups = $derived(
    CATEGORIES.map((c) => ({
      ...c,
      entries: entries.filter((e) => e.category === c.id).sort((a, b) => a.title.localeCompare(b.title, "de")),
    })).filter((g) => g.entries.length > 0),
  );

  function personNames(entry: Entry): string {
    if (entry.personIds.length === 0) return "alle";
    return entry.personIds
      .map((id) => persons.find((p) => p.id === id)?.name)
      .filter(Boolean)
      .join(", ");
  }

  function rows(entry: Entry): [string, string][] {
    const term = [
      entry.startDate && `ab ${formatDate(entry.startDate)}`,
      entry.endDate && `bis ${formatDate(entry.endDate)}`,
      entry.autoRenew && "verlängert sich automatisch",
    ]
      .filter(Boolean)
      .join(", ");
    const all: [string, string][] = [
      ["Anbieter", entry.provider],
      ["Nummer", entry.reference],
      ["Gehört zu", personNames(entry)],
      ["Kontakt", entry.contact],
      ["Kosten", entry.costCents !== null ? `${formatCents(entry.costCents)} ${intervalLabel(entry.interval)}` : ""],
      ["Zahlungsweg", entry.paymentMethod],
      ["Laufzeit", term],
      ["Kündigungsfrist", entry.noticePeriod],
      ["Zugangsdaten", entry.accessHint],
      ["Unterlagen", entry.storageLocation],
      ["Im Todesfall", [entry.deathAction && deathActionLabel(entry.deathAction), entry.deathNotes].filter(Boolean).join(": ")],
      ["Abwicklung", entry.status !== "offen" || entry.statusNotes ? [statusLabel(entry.status), entry.statusNotes].filter(Boolean).join(": ") : ""],
      ["Notizen", entry.notes],
    ];
    return all.filter(([, value]) => value);
  }

  async function print() {
    error = null;
    try {
      await backend.print();
    } catch (err) {
      error = errorMessage(err);
    }
  }
</script>

<div class="no-print bar">
  <p class="muted">Über den Druckdialog lässt sich die Übersicht auch als PDF speichern.</p>
  <button class="primary" onclick={print}>Drucken / als PDF speichern</button>
</div>
{#if error}<p class="error no-print">{error}</p>{/if}

<article class="print">
  <h1>Vorsorgeordner{person ? `: ${person.name}` : ""}</h1>
  <p class="muted">Stand: {formatDate(new Date().toISOString())}</p>

  {#each shownPersons as p (p.id)}
    {#if p.birthDate || p.deathDate || p.notes}
      <section class="person">
        <h2>{p.name}</h2>
        <p>
          {#if p.birthDate}geboren am {formatDate(p.birthDate)}{/if}
          {#if p.deathDate} · verstorben am {formatDate(p.deathDate)}{/if}
        </p>
        {#if p.notes}<p class="pre">{p.notes}</p>{/if}
      </section>
    {/if}
  {/each}

  {#each groups as group (group.id)}
    <h2>{group.label}</h2>
    {#each group.entries as entry (entry.id)}
      <section class="entry">
        <h3>{entry.title}</h3>
        <dl>
          {#each rows(entry) as [label, value] (label)}
            <dt>{label}</dt>
            <dd class="pre">{value}</dd>
          {/each}
        </dl>
      </section>
    {/each}
  {/each}
</article>

<style>
  .bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  .bar p {
    margin: 0;
  }
  .print {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 24px 28px;
  }
  h1 {
    margin: 0 0 4px;
  }
  h2 {
    margin: 28px 0 8px;
    font-size: 1.15em;
    border-bottom: 1px solid var(--border);
    padding-bottom: 4px;
  }
  h3 {
    margin: 0 0 6px;
    font-size: 1em;
  }
  .entry {
    margin: 12px 0 16px;
    break-inside: avoid;
  }
  dl {
    display: grid;
    grid-template-columns: 140px 1fr;
    gap: 2px 12px;
    margin: 0;
  }
  dt {
    color: var(--muted);
  }
  dd {
    margin: 0;
  }
  .pre {
    white-space: pre-wrap;
  }
  @media print {
    .print {
      border: none;
      padding: 0;
      background: none;
    }
  }
</style>
