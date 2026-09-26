<script>
  import Workspace from "$lib/Workspace.svelte"

  let { data } = $props()
</script>

{#key data.key}
  <Workspace {data} />
{/key}
