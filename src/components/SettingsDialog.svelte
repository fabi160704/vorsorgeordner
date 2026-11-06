<script lang="ts">
  import { onMount } from "svelte";
  import { backend, errorMessage } from "../lib/backend";
  import { toCsv, toJson } from "../lib/export";
  import { store } from "../lib/state.svelte";
  import { AUTO_LOCK_OPTIONS, todayIso } from "../lib/model";

  const MIN_LEN = 12;

  interface Props {
    onclose: () => void;
  }

  let { onclose }: Props = $props();

  let dialog: HTMLDialogElement;

  let current = $state("");
  let next = $state("");
  let next2 = $state("");
  let passBusy = $state(false);
  let passError = $state<string | null>(null);
  let passDone = $state(false);

  let exportMessage = $state<string | null>(null);
  let exportError = $state<string | null>(null);

  const autoLock = $derived(store.vault?.settings.autoLockMinutes ?? 0);
  const canChange = $derived(!passBusy && current.length > 0 && next.length >= MIN_LEN && next === next2);

  onMount(() => dialog.showModal());

  async function changePassphrase(event: SubmitEvent) {
    event.preventDefault();
    if (!canChange) return;
    passBusy = true;
    passError = null;
    passDone = false;
    try {
      await store.changePassphrase(current, next);
      passDone = true;
      current = "";
      next = "";
      next2 = "";
    } catch (err) {
      passError = errorMessage(err);
    } finally {
      passBusy = false;
    }
  }

  async function exportAs(kind: "json" | "csv") {
    exportMessage = null;
    exportError = null;
    const vault = store.snapshot();
    if (!vault) return;
    const ok = await backend.confirm(
      "Der Export ist nicht verschlüsselt. Jeder, der die Datei öffnet, kann alle Angaben lesen. " +
        "Die Datei nach Gebrauch löschen und nicht in Cloud-Ordnern ablegen. Fortfahren?",
    );
    if (!ok) return;
    try {
      const name = `Vorsorgeordner-${todayIso()}.${kind}`;
      const path = await backend.exportPlain(name, kind, kind === "json" ? toJson(vault) : toCsv(vault));
      if (path) exportMessage = `Exportiert nach ${path}`;
    } catch (err) {
      exportError = errorMessage(err);
    }
  }
</script>

<dialog bind:this={dialog} onclose={onclose}>
  <header>
    <h2>Einstellungen</h2>
  </header>

  <div class="body">
    <section>
      <h3>Automatisch speichern</h3>
      <label class="check">
        <input
          type="checkbox"
          checked={store.autoSave}
          onchange={(e) => store.setAutoSave(e.currentTarget.checked)}
        />
        Änderungen wenige Sekunden nach der letzten Eingabe speichern
      </label>
      <p class="hint">
        Die Sicherungskopie (.bak neben der Datei) enthält immer den Stand vom Öffnen der Datei. Ohne automatisches
        Speichern speichert man mit dem Knopf oben oder mit Strg+S.
      </p>
    </section>

    <section>
      <h3>Automatisch sperren</h3>
      <label class="field">
        <span class="label">Sperren nach</span>
        <select value={autoLock} onchange={(e) => store.setAutoLock(Number(e.currentTarget.value))}>
          {#each AUTO_LOCK_OPTIONS as minutes (minutes)}
            <option value={minutes}>{minutes === 0 ? "nie" : `${minutes} Minuten ohne Eingabe`}</option>
          {/each}
        </select>
      </label>
      <p class="hint">
        Vor dem Sperren werden ungespeicherte Änderungen gespeichert. Die Einstellung wird in der Datei gespeichert.
      </p>
    </section>

    <section>
      <h3>Passphrase ändern</h3>
      <form onsubmit={changePassphrase}>
        <label class="field">
          <span class="label">Bisherige Passphrase</span>
          <input type="password" bind:value={current} autocomplete="current-password" />
        </label>
        <div class="grid">
          <label class="field">
            <span class="label">Neue Passphrase</span>
            <input type="password" bind:value={next} autocomplete="new-password" />
          </label>
          <label class="field">
            <span class="label">Neue Passphrase wiederholen</span>
            <input type="password" bind:value={next2} autocomplete="new-password" />
          </label>
        </div>
        {#if next && next.length < MIN_LEN}
          <p class="error">Mindestens {MIN_LEN} Zeichen.</p>
        {:else if next2 && next !== next2}
          <p class="error">Die neuen Passphrasen stimmen nicht überein.</p>
        {/if}
        <p class="hint">
          Die Datei und ihre Sicherungskopie werden mit der neuen Passphrase gespeichert, ungespeicherte Änderungen
          eingeschlossen. Ältere Kopien, etwa im Versionsverlauf eines Cloud-Ordners oder auf einem USB-Stick, lassen
          sich weiter mit der alten Passphrase öffnen. Die hinterlegte Papierkopie der Passphrase muss ebenfalls
          erneuert werden.
        </p>
        {#if passError}<p class="error">{passError}</p>{/if}
        {#if passDone}<p class="notice">Die Passphrase wurde geändert.</p>{/if}
        <div>
          <button type="submit" class="primary" disabled={!canChange}>
            {passBusy ? "Bitte warten …" : "Passphrase ändern"}
          </button>
        </div>
      </form>
    </section>

    <section>
      <h3>Exportieren</h3>
      <p class="hint">
        JSON enthält alle Daten und dient als Sicherung oder zur Weiterverarbeitung. CSV enthält die Einträge als
        Tabelle für Excel oder LibreOffice. Beide Formate sind unverschlüsselt. Der JSON-Export enthält auch den
        Schlüssel, mit dem sich die Anhänge entschlüsseln lassen.
      </p>
      <div class="row">
        <button onclick={() => exportAs("json")}>Als JSON exportieren</button>
        <button onclick={() => exportAs("csv")}>Als CSV exportieren</button>
      </div>
      {#if exportMessage}<p class="notice">{exportMessage}</p>{/if}
      {#if exportError}<p class="error">{exportError}</p>{/if}
    </section>
  </div>

  <footer>
    <button onclick={() => dialog.close()}>Schließen</button>
  </footer>
</dialog>

<style>
  dialog {
    width: min(620px, calc(100vw - 32px));
    max-height: calc(100vh - 48px);
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--bg);
    color: var(--text);
  }
  dialog[open] {
    display: flex;
    flex-direction: column;
  }
  dialog::backdrop {
    background: rgb(0 0 0 / 0.4);
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
    padding: 0 20px 16px;
  }
  section {
    display: grid;
    gap: 10px;
    padding: 16px 0;
  }
  section + section {
    border-top: 1px solid var(--border);
  }
  h3 {
    margin: 0;
    font-size: 1em;
  }
  form {
    display: grid;
    gap: 10px;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px 14px;
  }
  .row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  footer {
    display: flex;
    justify-content: flex-end;
    border-top: 1px solid var(--border);
  }
  @media (max-width: 600px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
