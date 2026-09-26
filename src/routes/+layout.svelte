<script>
  import "../app.css"

  let { children } = $props()

  const setTheme = (theme) => window.dispatchEvent(new CustomEvent("beatbox:set-theme", { detail: theme }))
</script>

<header class="navbar px-4 sm:px-6 lg:px-8">
  <div class="flex-1">
    <a href="/" class="flex w-fit flex-1 items-center gap-2">
      <span class="text-lg font-bold tracking-tight">Beatbox</span>
    </a>
  </div>
  <div class="flex-none">
    <!-- Theme toggle: system / light / dark (applied by the script in app.html). -->
    <div class="card relative flex flex-row items-center rounded-full border-2 border-base-300 bg-base-300">
      <div
        class="absolute left-0 h-full w-1/3 rounded-full border-1 border-base-200 bg-base-100 brightness-200 transition-[left] [[data-theme=dark]_&]:left-2/3 [[data-theme=light]_&]:left-1/3 [[data-theme-source=system]_&]:!left-0"
      ></div>
      <button class="flex w-1/3 cursor-pointer p-2" aria-label="System theme" onclick={() => setTheme("system")}>
        <span class="hero-computer-desktop-micro size-4 opacity-75 hover:opacity-100"></span>
      </button>
      <button class="flex w-1/3 cursor-pointer p-2" aria-label="Light theme" onclick={() => setTheme("light")}>
        <span class="hero-sun-micro size-4 opacity-75 hover:opacity-100"></span>
      </button>
      <button class="flex w-1/3 cursor-pointer p-2" aria-label="Dark theme" onclick={() => setTheme("dark")}>
        <span class="hero-moon-micro size-4 opacity-75 hover:opacity-100"></span>
      </button>
    </div>
  </div>
</header>

<main class="px-4 py-8 sm:px-6 lg:px-8">
  <div class="mx-auto max-w-5xl space-y-4">
    {@render children()}
  </div>
</main>
