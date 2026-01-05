<script lang="ts">
  let { active = $bindable(false) }: { active: boolean } = $props()

  export function flash() {
    active = true
    setTimeout(() => (active = false), 100)
  }
</script>

<div class="flash" class:active></div>

<style>
  .flash {
    position: fixed;
    inset: 0;
    background: #3b82f6;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.1s;
  }
  .flash.active {
    opacity: 0.5;
  }
</style>
