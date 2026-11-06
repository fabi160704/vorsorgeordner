<script lang="ts">
  import { store } from "./lib/state.svelte";
  import Unlock from "./components/Unlock.svelte";
  import Workspace from "./components/Workspace.svelte";
</script>

{#if store.vault}
  <Workspace />
{:else}
  <Unlock />
{/if}
