<script lang="ts">
  import { initAudio, playClick } from '$lib/audio'
  import Flash from '$lib/Flash.svelte'

  let flashActive = $state(false)
  let error = $state('')

  function flash() {
    flashActive = true
    setTimeout(() => (flashActive = false), 100)
  }

  async function handleClick() {
    try {
      await initAudio()
      if (playClick()) flash()
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
  }
</script>

<Flash bind:active={flashActive} />

<button class="click-btn" onclick={handleClick}>
  {error || 'Click!'}
</button>

<style>
  .click-btn {
    width: 250px;
    height: 250px;
    font-size: 2rem;
    cursor: pointer;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 50%;
    transition: transform 0.1s;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .click-btn:hover {
    background: #2563eb;
  }
  .click-btn:active {
    transform: scale(0.95);
  }
</style>
