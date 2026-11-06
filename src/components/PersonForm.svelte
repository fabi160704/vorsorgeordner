<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { backend } from "../lib/backend";
  import type { Person } from "../lib/model";

  interface Props {
    person: Person;
    isNew: boolean;
    onsave: (person: Person) => void;
    ondelete: (id: string) => void;
    onclose: () => void;
  }

  let { person, isNew, onsave, ondelete, onclose }: Props = $props();

  const original = untrack(() => $state.snapshot(person)) as Person;
  let draft = $state<Person>(structuredClone(original));
  let dialog: HTMLDialogElement;

  onMount(() => dialog.showModal());

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!draft.name.trim()) return;
    onsave({ ...$state.snapshot(draft), name: draft.name.trim() });
  }

  async function remove() {
    const ok = await backend.confirm(
      `"${original.name}" entfernen? Die Einträge bleiben erhalten und gelten danach für alle Personen.`,
    );
    if (ok) ondelete(original.id);
  }
</script>

<dialog bind:this={dialog} onclose={onclose}>
  <form onsubmit={submit}>
    <h2>{isNew ? "Neue Person" : original.name}</h2>
    <label class="field">
      <span class="label">Name *</span>
      <input bind:value={draft.name} required />
    </label>
    <div class="grid">
      <label class="field">
        <span class="label">Geburtsdatum</span>
        <input type="date" bind:value={draft.birthDate} />
      </label>
      <label class="field">
        <span class="label">Sterbedatum</span>
        <input type="date" bind:value={draft.deathDate} />
        <span class="hint">Schaltet den Abwicklungsstatus für die Einträge frei.</span>
      </label>
    </div>
    <label class="field">
      <span class="label">Hinweise</span>
      <textarea rows="5" bind:value={draft.notes} placeholder="z. B. Wünsche zur Bestattung, Haustiere, Ersatzschlüssel, wen informieren"></textarea>
    </label>
    <footer>
      {#if !isNew}
        <button type="button" class="danger" onclick={remove}>Entfernen</button>
      {/if}
      <span class="spacer"></span>
      <button type="button" onclick={() => dialog.close()}>Abbrechen</button>
      <button type="submit" class="primary" disabled={!draft.name.trim()}>Übernehmen</button>
    </footer>
  </form>
</dialog>

<style>
  dialog {
    width: min(520px, calc(100vw - 32px));
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--bg);
    color: var(--text);
    padding: 20px;
  }
  dialog::backdrop {
    background: rgb(0 0 0 / 0.4);
  }
  form {
    display: grid;
    gap: 12px;
  }
  h2 {
    margin: 0;
    font-size: 1.15em;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  footer {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }
  .spacer {
    flex: 1;
  }
</style>
