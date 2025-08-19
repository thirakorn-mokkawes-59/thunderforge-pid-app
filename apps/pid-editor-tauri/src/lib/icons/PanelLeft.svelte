<script lang="ts">
  export let size = 24;
  export let strokeWidth = 2;
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect>
  <line x1="9" x2="9" y1="3" y2="21"></line>
</svg>