<script lang="ts">
  import { enhance } from '$app/forms'
  import { CircleAlert, Mail } from '@lucide/svelte'

  import type { PageProps } from './$types'

  let { data, form }: PageProps = $props()
  let sending = $state(false)
</script>

<svelte:head>
  <title>Sign in · Beatbox</title>
</svelte:head>

<div
  class="mx-auto max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-zinc-100 shadow-lg shadow-black/40"
>
  {#if form && 'sent' in form}
    <div id="link-sent" class="space-y-2 text-center">
      <Mail class="mx-auto size-8 text-amber-400" />
      <h1 class="text-lg font-semibold tracking-tight">Check your email</h1>
      <p class="text-sm text-zinc-400">
        We sent a sign-in link to <span class="text-zinc-200">{form.sent}</span>. It works once, for
        the next five minutes.
      </p>
    </div>
  {:else}
    <h1 class="text-lg font-semibold tracking-tight">Sign in to Beatbox</h1>
    <p class="mt-1 text-sm text-zinc-400">
      Enter your email and we'll send you a link. New here? The same link creates your account.
    </p>

    {#if form?.error ?? data.linkError}
      <p id="sign-in-error" role="alert" class="mt-4 flex items-start gap-2 text-sm text-red-400">
        <CircleAlert class="size-4 shrink-0 translate-y-0.5" />
        {form?.error ?? 'That link has expired or was already used. Send yourself a new one.'}
      </p>
    {/if}

    <form
      id="sign-in-form"
      method="POST"
      class="mt-4 space-y-3"
      use:enhance={() => {
        sending = true
        return async ({ update }) => {
          await update()
          sending = false
        }
      }}
    >
      <input type="hidden" name="next" value={data.next} />
      <input
        id="sign-in-email"
        name="email"
        type="email"
        required
        autocomplete="email"
        placeholder="you@example.com"
        aria-label="Email"
        value={form?.email ?? ''}
        class="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-400 focus:outline-none"
      />
      <button
        id="send-link"
        type="submit"
        disabled={sending}
        class="w-full cursor-pointer rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-900 shadow shadow-amber-400/20 transition hover:bg-amber-300 active:scale-95 disabled:opacity-60"
      >
        Email me a sign-in link
      </button>
    </form>
  {/if}
</div>
