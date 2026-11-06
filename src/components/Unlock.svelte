<script lang="ts">
  import { backend, errorMessage } from "../lib/backend";
  import { store } from "../lib/state.svelte";

  const MIN_LEN = 12;

  let mode = $state<"open" | "create">(store.recentPath ? "open" : "create");
  let path = $state<string | null>(store.recentPath);
  let passphrase = $state("");
  let passphrase2 = $state("");
  let busy = $state(false);
  let error = $state<string | null>(null);

  const fileName = $derived(path ? path.split(/[\\/]/).pop() : null);
  const canSubmit = $derived(
    !busy &&
      path !== null &&
      (mode === "open" ? passphrase.length > 0 : passphrase.length >= MIN_LEN && passphrase === passphrase2),
  );

  function switchMode(next: "open" | "create") {
    mode = next;
    path = next === "open" ? store.recentPath : null;
    passphrase = "";
    passphrase2 = "";
    error = null;
  }

  async function pickFile() {
    error = null;
    const picked = mode === "open" ? await backend.pickExistingFile() : await backend.pickNewFile();
    if (picked) path = picked;
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!canSubmit || !path) return;
    busy = true;
    error = null;
    try {
      if (mode === "open") await store.open(path, passphrase);
      else await store.create(path, passphrase);
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = false;
      passphrase = "";
      passphrase2 = "";
    }
  }
</script>

<main class="unlock">
  <form class="card" onsubmit={submit}>
    <h1>Vorsorgeordner</h1>
    <p class="muted">Verträge, Versicherungen und wichtige Hinweise an einem Ort, verschlüsselt in einer Datei.</p>

    {#if backend.isPreview}
      <p class="notice">
        Browser-Vorschau mit Beispieldaten. Hier wird nichts gespeichert. Die Desktop-App startet mit
        <code>npm run tauri dev</code>.
      </p>
    {/if}

    <div class="tabs" role="tablist">
      <button type="button" role="tab" aria-selected={mode === "open"} onclick={() => switchMode("open")}>
        Öffnen
      </button>
      <button type="button" role="tab" aria-selected={mode === "create"} onclick={() => switchMode("create")}>
        Neu anlegen
      </button>
    </div>

    <div class="field">
      <span class="label">Datei</span>
      <div class="row">
        <span class="file" title={path ?? ""}>{fileName ?? "keine Datei gewählt"}</span>
        <button type="button" onclick={pickFile}>{mode === "open" ? "Datei wählen" : "Speicherort wählen"}</button>
      </div>
    </div>

    <label class="field">
      <span class="label">Passphrase</span>
      <input type="password" bind:value={passphrase} autocomplete={mode === "open" ? "current-password" : "new-password"} />
    </label>

    {#if mode === "create"}
      <label class="field">
        <span class="label">Passphrase wiederholen</span>
        <input type="password" bind:value={passphrase2} autocomplete="new-password" />
      </label>
      <p class="hint">
        Mindestens {MIN_LEN} Zeichen. Ohne Passphrase lässt sich die Datei nicht mehr öffnen, auch nicht durch
        Angehörige. Am besten auf Papier notieren und bei Testament oder Vorsorgevollmacht hinterlegen.
      </p>
      {#if passphrase2 && passphrase !== passphrase2}
        <p class="error">Die Passphrasen stimmen nicht überein.</p>
      {/if}
    {/if}

    {#if error}
      <p class="error">{error}</p>
    {/if}

    <button class="primary" type="submit" disabled={!canSubmit}>
      {#if busy}
        Bitte warten …
      {:else if mode === "open"}
        Entsperren
      {:else}
        Vorsorgeordner anlegen
      {/if}
    </button>
  </form>
</main>

<style>
  .unlock {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 24px 16px;
  }
  .card {
    width: min(460px, 100%);
    display: grid;
    gap: 14px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 28px;
  }
  h1 {
    margin: 0;
  }
  .muted {
    margin: 0;
    color: var(--muted);
  }
  .tabs {
    display: flex;
    gap: 4px;
    border-bottom: 1px solid var(--border);
  }
  .tabs button {
    border: none;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    background: none;
    padding: 8px 12px;
  }
  .tabs button[aria-selected="true"] {
    border-bottom-color: var(--accent);
    color: var(--accent);
    font-weight: 600;
  }
  .row {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .file {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--muted);
  }
  .primary {
    margin-top: 4px;
  }
</style>
