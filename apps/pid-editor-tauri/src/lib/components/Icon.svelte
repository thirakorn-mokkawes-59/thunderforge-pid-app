<script lang="ts">
  export let size = 20;
  export let strokeWidth = 2;
  export let color = 'currentColor';
  export let class_ = '';
  export let title = '';
</script>

<span 
  class="icon {class_}" 
  style="color: {color}"
  {title}
>
  <slot {size} {strokeWidth} />
</span>

<style>
  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    vertical-align: middle;
    line-height: 1;
  }
</style>