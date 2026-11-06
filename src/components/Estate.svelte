<script lang="ts">
  import { daysSince, ESTATE_STEPS, estateTasks, stepKey, stepStatus } from "../lib/estate";
  import {
    SETTLEMENT_STATUS,
    deathActionLabel,
    formatDate,
    todayIso,
    type Entry,
    type Person,
    type SettlementStatus,
    type Vault,
  } from "../lib/model";

  interface Props {
    vault: Vault;
    deceased: Person[];
    onedit: (entry: Entry) => void;
    onentrystatus: (id: string, status: SettlementStatus, notes?: string) => void;
    onstepstatus: (key: string, status: SettlementStatus) => void;
  }

  let { vault, deceased, onedit, onentrystatus, onstepstatus }: Props = $props();

  const today = todayIso();
</script>

{#snippet statusButtons(value: SettlementStatus, onchange: (status: SettlementStatus) => void, label: string)}
  <div class="segmented" role="radiogroup" aria-label={label}>
    {#each SETTLEMENT_STATUS as s (s.id)}
      <button role="radio" aria-checked={value === s.id} class="status-{s.id}" onclick={() => onchange(s.id)}>
        {s.label}
      </button>
    {/each}
  </div>
{/snippet}

{#each deceased as person (person.id)}
  {@const tasks = estateTasks(vault.entries, person.id)}
  {@const stepsDone = ESTATE_STEPS.filter((s) => stepStatus(vault, s.id, person.id) === "erledigt").length}
  {@const tasksDone = tasks.filter((t) => t.status === "erledigt").length}
  <section class="person">
    <header>
      <h2>Abwicklung für {person.name}</h2>
      <p class="muted">
        verstorben am {formatDate(person.deathDate)}, vor {daysSince(person.deathDate, today)} Tagen ·
        {stepsDone + tasksDone} von {ESTATE_STEPS.length + tasks.length} Aufgaben erledigt
      </p>
    </header>

    <h3>Erste Schritte <span class="count">{stepsDone}/{ESTATE_STEPS.length}</span></h3>
    <ul class="tasks">
      {#each ESTATE_STEPS as step (step.id)}
        {@const status = stepStatus(vault, step.id, person.id)}
        <li class:done={status === "erledigt"}>
          <div class="text">
            <span class="name">{step.title}</span>
            <span class="muted">{step.hint}{#if step.source}{` (${step.source})`}{/if}</span>
          </div>
          {@render statusButtons(status, (s) => onstepstatus(stepKey(step.id, person.id), s), step.title)}
        </li>
      {/each}
    </ul>

    <h3>Verträge, Konten und Versicherungen <span class="count">{tasksDone}/{tasks.length}</span></h3>
    {#if tasks.length === 0}
      <p class="muted">Für {person.name} sind keine Einträge erfasst.</p>
    {:else}
      <ul class="tasks">
        {#each tasks as entry (entry.id)}
          <li class:done={entry.status === "erledigt"}>
            <div class="text">
              <span class="name">
                <button class="link" onclick={() => onedit(entry)}>{entry.title}</button>
                <span class="tag">{entry.deathAction ? deathActionLabel(entry.deathAction) : "Aktion festlegen"}</span>
                {#if entry.personIds.length !== 1}<span class="tag">gemeinsam</span>{/if}
              </span>
              <span class="muted">{[entry.provider, entry.reference].filter(Boolean).join(" · ")}</span>
              {#if entry.contact}<span class="muted pre">{entry.contact}</span>{/if}
              {#if entry.deathNotes}<span class="pre">{entry.deathNotes}</span>{/if}
              <input
                class="notes"
                placeholder="Notiz, z. B. Kündigung am 03.11. per Einschreiben verschickt"
                value={entry.statusNotes}
                onchange={(e) => onentrystatus(entry.id, entry.status, e.currentTarget.value)}
                aria-label="Notiz zu {entry.title}"
              />
            </div>
            {@render statusButtons(entry.status, (s) => onentrystatus(entry.id, s), entry.title)}
          </li>
        {/each}
      </ul>
    {/if}
  </section>
{/each}

<p class="hint">
  Allgemeine Hinweise ohne Gewähr und ohne Rechtsberatung, Stand November 2026. Fristen im Einzelfall beim Standesamt,
  Nachlassgericht, Finanzamt oder bei einer Beratungsstelle prüfen. Die Reihenfolge der Einträge richtet sich nach der
  Aktion: Tod melden und Leistungen beantragen zuerst, weil Versicherungen dafür oft kurze Fristen setzen.
</p>

<style>
  .person + .person {
    margin-top: 40px;
    padding-top: 24px;
    border-top: 1px solid var(--border);
  }
  header h2 {
    margin: 0;
    font-size: 1.2em;
  }
  header p {
    margin: 4px 0 0;
  }
  h3 {
    margin: 24px 0 8px;
    font-size: 1em;
  }
  .count {
    color: var(--muted);
    font-weight: normal;
  }
  .tasks {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
  }
  .tasks li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 16px;
    align-items: start;
    padding: 12px 14px;
  }
  .tasks li + li {
    border-top: 1px solid var(--border);
  }
  .tasks li.done .name,
  .tasks li.done .name button {
    color: var(--muted);
  }
  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .name {
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .pre {
    white-space: pre-wrap;
  }
  .notes {
    margin-top: 6px;
    font-size: 0.9em;
  }
  .segmented {
    display: inline-flex;
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
  }
  .segmented button {
    border: none;
    border-radius: 0;
    padding: 4px 10px;
    font-size: 0.85em;
    white-space: nowrap;
  }
  .segmented button + button {
    border-left: 1px solid var(--border);
  }
  .segmented button[aria-checked="true"] {
    background: var(--hover);
    font-weight: 600;
  }
  .segmented button.status-erledigt[aria-checked="true"] {
    background: var(--accent-soft);
    color: var(--accent);
  }
  .segmented button.status-in_bearbeitung[aria-checked="true"] {
    background: var(--notice-bg);
    color: var(--warn);
  }
  .hint {
    margin-top: 24px;
  }
  @media (max-width: 760px) {
    .tasks li {
      grid-template-columns: 1fr;
    }
  }
</style>
