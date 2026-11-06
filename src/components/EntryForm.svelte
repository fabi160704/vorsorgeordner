<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { backend } from "../lib/backend";
  import {
    CATEGORIES,
    DEATH_ACTIONS,
    INTERVALS,
    SETTLEMENT_STATUS,
    centsToInput,
    parseEuro,
    todayIso,
    type Entry,
    type Person,
  } from "../lib/model";

  interface Props {
    entry: Entry;
    isNew: boolean;
    persons: Person[];
    onsave: (entry: Entry) => void;
    ondelete: (id: string) => void;
    onclose: () => void;
  }

  let { entry, isNew, persons, onsave, ondelete, onclose }: Props = $props();

  // Bearbeitet wird eine Kopie. Erst "Übernehmen" ändert den Vorsorgeordner.
  const original = untrack(() => $state.snapshot(entry)) as Entry;
  let draft = $state<Entry>(structuredClone(original));
  let costInput = $state(centsToInput(original.costCents));
  let dialog: HTMLDialogElement;

  const categoryHint = $derived(CATEGORIES.find((c) => c.id === draft.category)?.hint ?? "");
  const costCents = $derived(parseEuro(costInput));
  const costInvalid = $derived(costInput.trim() !== "" && costCents === null);
  const showsSettlement = $derived(
    draft.personIds.some((id) => persons.find((p) => p.id === id)?.deathDate) || draft.status !== "offen",
  );

  onMount(() => dialog.showModal());

  function togglePerson(id: string, checked: boolean) {
    draft.personIds = checked ? [...draft.personIds, id] : draft.personIds.filter((p) => p !== id);
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (costInvalid || !draft.title.trim()) return;
    onsave({ ...$state.snapshot(draft), title: draft.title.trim(), costCents });
  }

  async function remove() {
    if (await backend.confirm(`"${original.title}" wirklich löschen?`)) ondelete(original.id);
  }
</script>

<dialog bind:this={dialog} onclose={onclose}>
  <form onsubmit={submit}>
    <header>
      <h2>{isNew ? "Neuer Eintrag" : draft.title || "Eintrag"}</h2>
    </header>

    <div class="body">
      <fieldset>
        <legend>Allgemein</legend>
        <div class="grid">
          <label class="field">
            <span class="label">Kategorie</span>
            <select bind:value={draft.category}>
              {#each CATEGORIES as c (c.id)}
                <option value={c.id}>{c.label}</option>
              {/each}
            </select>
            {#if categoryHint}<span class="hint">{categoryHint}</span>{/if}
          </label>
          <label class="field">
            <span class="label">Bezeichnung *</span>
            <input bind:value={draft.title} required placeholder="z. B. Hausratversicherung" />
          </label>
          <label class="field">
            <span class="label">Anbieter / Institution</span>
            <input bind:value={draft.provider} />
          </label>
          <label class="field">
            <span class="label">Vertrags-, Mitglieds- oder Kundennummer</span>
            <input bind:value={draft.reference} />
          </label>
        </div>
        {#if persons.length > 0}
          <div class="field">
            <span class="label">Gehört zu</span>
            <div class="checks">
              {#each persons as person (person.id)}
                <label class="check">
                  <input
                    type="checkbox"
                    checked={draft.personIds.includes(person.id)}
                    onchange={(e) => togglePerson(person.id, e.currentTarget.checked)}
                  />
                  {person.name || "Ohne Namen"}
                </label>
              {/each}
            </div>
            <span class="hint">Ohne Auswahl gilt der Eintrag für alle Personen.</span>
          </div>
        {/if}
        <label class="field">
          <span class="label">Kontakt</span>
          <textarea rows="2" bind:value={draft.contact} placeholder="Telefon, E-Mail, Adresse, Website"></textarea>
        </label>
      </fieldset>

      <fieldset>
        <legend>Kosten und Laufzeit</legend>
        <div class="grid">
          <label class="field">
            <span class="label">Betrag in €</span>
            <input bind:value={costInput} inputmode="decimal" placeholder="0,00" aria-invalid={costInvalid} />
            {#if costInvalid}<span class="error">Bitte einen Betrag wie 12,99 eingeben.</span>{/if}
          </label>
          <label class="field">
            <span class="label">Intervall</span>
            <select bind:value={draft.interval}>
              {#each INTERVALS as i (i.id)}
                <option value={i.id}>{i.label}</option>
              {/each}
            </select>
          </label>
          <label class="field wide">
            <span class="label">Zahlungsweg</span>
            <input bind:value={draft.paymentMethod} placeholder="z. B. Lastschrift vom Girokonto" />
          </label>
          <label class="field">
            <span class="label">Beginn</span>
            <input type="date" bind:value={draft.startDate} />
          </label>
          <label class="field">
            <span class="label">Ende / nächster Ablauf</span>
            <input type="date" bind:value={draft.endDate} />
          </label>
          <label class="field">
            <span class="label">Kündigungsfrist</span>
            <input bind:value={draft.noticePeriod} placeholder="z. B. 3 Monate zum Ablauf" />
          </label>
          <label class="check field">
            <input type="checkbox" bind:checked={draft.autoRenew} />
            verlängert sich automatisch
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Zugang und Unterlagen</legend>
        <label class="field">
          <span class="label">Wo liegen die Zugangsdaten?</span>
          <input bind:value={draft.accessHint} placeholder="z. B. Passwortmanager, Eintrag 'Stadtwerke'" />
          <span class="hint">Nur einen Hinweis eintragen, keine Passwörter.</span>
        </label>
        <label class="field">
          <span class="label">Wo liegen die Unterlagen?</span>
          <input bind:value={draft.storageLocation} placeholder="z. B. Ordner 'Versicherungen', Register 3" />
        </label>
      </fieldset>

      <fieldset>
        <legend>Im Todesfall</legend>
        <div class="grid">
          <label class="field">
            <span class="label">Was ist zu tun?</span>
            <select bind:value={draft.deathAction}>
              {#each DEATH_ACTIONS as a (a.id)}
                <option value={a.id}>{a.label}</option>
              {/each}
            </select>
          </label>
          <label class="field wide">
            <span class="label">Hinweise</span>
            <textarea rows="2" bind:value={draft.deathNotes} placeholder="z. B. Bezugsberechtigte, benötigte Unterlagen, Fristen"></textarea>
          </label>
        </div>
        {#if showsSettlement}
          <div class="grid">
            <label class="field">
              <span class="label">Stand der Abwicklung</span>
              <select bind:value={draft.status}>
                {#each SETTLEMENT_STATUS as s (s.id)}
                  <option value={s.id}>{s.label}</option>
                {/each}
              </select>
            </label>
            <label class="field wide">
              <span class="label">Notiz zur Abwicklung</span>
              <input bind:value={draft.statusNotes} placeholder="z. B. Kündigung am 03.11. per Einschreiben verschickt" />
            </label>
          </div>
        {/if}
      </fieldset>

      <fieldset>
        <legend>Sonstiges</legend>
        <label class="field">
          <span class="label">Notizen</span>
          <textarea rows="3" bind:value={draft.notes}></textarea>
        </label>
        <div class="row">
          <label class="field">
            <span class="label">Zuletzt geprüft</span>
            <input type="date" bind:value={draft.lastReviewed} />
          </label>
          <button type="button" onclick={() => (draft.lastReviewed = todayIso())}>Heute geprüft</button>
        </div>
      </fieldset>
    </div>

    <footer>
      {#if !isNew}
        <button type="button" class="danger" onclick={remove}>Löschen</button>
      {/if}
      <span class="spacer"></span>
      <button type="button" onclick={() => dialog.close()}>Abbrechen</button>
      <button type="submit" class="primary" disabled={costInvalid || !draft.title.trim()}>Übernehmen</button>
    </footer>
  </form>
</dialog>

<style>
  dialog {
    width: min(760px, calc(100vw - 32px));
    max-height: calc(100vh - 48px);
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--bg);
    color: var(--text);
  }
  dialog::backdrop {
    background: rgb(0 0 0 / 0.4);
  }
  form {
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 50px);
  }
  header,
  footer {
    padding: 14px 20px;
  }
  header {
    border-bottom: 1px solid var(--border);
  }
  header h2 {
    margin: 0;
    font-size: 1.15em;
  }
  .body {
    overflow-y: auto;
    padding: 8px 20px 16px;
  }
  fieldset {
    border: none;
    padding: 0;
    margin: 16px 0 0;
    display: grid;
    gap: 10px;
  }
  legend {
    font-weight: 600;
    margin-bottom: 8px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px 14px;
  }
  .wide {
    grid-column: 1 / -1;
  }
  .checks {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
  }
  .row {
    display: flex;
    align-items: flex-end;
    gap: 10px;
  }
  footer {
    display: flex;
    gap: 8px;
    border-top: 1px solid var(--border);
  }
  .spacer {
    flex: 1;
  }
  @media (max-width: 600px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
