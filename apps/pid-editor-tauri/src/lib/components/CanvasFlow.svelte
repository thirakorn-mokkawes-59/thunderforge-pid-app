<script lang="ts">
  import { SvelteFlowProvider } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import InnerCanvas from './InnerCanvas.svelte';
</script>

<SvelteFlowProvider>
  <InnerCanvas />
</SvelteFlowProvider>