defmodule BeatboxWeb.SynthLive do
  @moduledoc """
  The music workspace: synth, loop pads and drum machine, saved together as a song.

  The Svelte components own the live state and push changes here (`update_*`
  events) into `@doc`, the unsaved working copy. Save persists `@doc` to the
  song. `@initial` is what the components mount with; it only changes when a
  different song is opened, and `@mount_key` changes with it so both components
  remount with fresh state. Props diffing is off (`diff={false}`) because LiveSvelte
  diffs per template call site, so a remounted component would otherwise mount
  from a partial diff instead of full props.
  """
  use BeatboxWeb, :live_view

  alias Beatbox.Music

  @param_keys ~w(osc1_wave osc1_octave osc1_detune osc1_level osc2_wave osc2_octave osc2_detune osc2_level filter_cutoff filter_resonance lfo_rate lfo_depth attack decay sustain release volume)

  @impl true
  def mount(_params, _session, socket) do
    {:ok, socket |> assign_presets() |> assign_songs()}
  end

  @impl true
  def handle_params(%{"id" => id}, _uri, socket) do
    case socket.assigns[:song] do
      # Just saved a new song and patched to its URL: keep the live state.
      %{id: ^id} ->
        {:noreply, socket}

      _ ->
        case Music.get_song(id) do
          {:ok, song} ->
            {:noreply, open(socket, song)}

          {:error, _} ->
            {:noreply, socket |> put_flash(:error, "Song not found") |> push_navigate(to: ~p"/")}
        end
    end
  end

  def handle_params(_params, _uri, socket), do: {:noreply, open(socket, nil)}

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash}>
      <div
        id="song-bar"
        class="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 text-zinc-100 shadow-lg shadow-black/40"
      >
        <%!-- Global transport: starts/stops the drums and every filled loop pad. The
             instruments report their state as `beatbox:state`, so the label follows
             them even when started/stopped individually. --%>
        <button
          id="transport"
          type="button"
          phx-hook=".Transport"
          phx-update="ignore"
          aria-pressed="false"
          class="group flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-zinc-950 shadow shadow-emerald-500/20 transition hover:bg-emerald-400 active:scale-95 aria-pressed:bg-zinc-100 aria-pressed:shadow-none aria-pressed:hover:bg-white"
        >
          <.icon name="hero-play-solid" class="size-4 group-aria-pressed:hidden" />
          <.icon name="hero-stop-solid" class="hidden size-4 group-aria-pressed:block" />
          <span data-label>Play all</span>
        </button>
        <script :type={Phoenix.LiveView.ColocatedHook} name=".Transport">
          export default {
            mounted() {
              this.playing = new Map()
              this.onState = (e) => {
                this.playing.set(e.detail.source, e.detail.playing)
                this.render()
              }
              window.addEventListener("beatbox:state", this.onState)
              this.el.addEventListener("click", () => {
                const play = !this.anyPlaying()
                window.dispatchEvent(new CustomEvent("beatbox:transport", { detail: { play } }))
              })
              // Ask already-mounted instruments to report in.
              window.dispatchEvent(new CustomEvent("beatbox:report"))
            },
            anyPlaying() {
              return [...this.playing.values()].some(Boolean)
            },
            render() {
              const on = this.anyPlaying()
              this.el.setAttribute("aria-pressed", String(on))
              this.el.querySelector("[data-label]").textContent = on ? "Stop all" : "Play all"
            },
            destroyed() {
              window.removeEventListener("beatbox:state", this.onState)
            },
          }
        </script>
        <.form
          for={@song_form}
          id="song-form"
          phx-change="rename"
          phx-submit="save_song"
          class="flex min-w-0 flex-1 items-center gap-2"
        >
          <span
            id="song-status"
            data-dirty={to_string(@dirty?)}
            class={[
              "size-2 shrink-0 rounded-full transition",
              if(@dirty?, do: "bg-amber-400", else: "bg-emerald-500")
            ]}
            title={if(@dirty?, do: "Unsaved changes", else: "Saved")}
          ></span>
          <%!-- [&_.fieldset]:mb-0 drops <.input>'s wrapper margin so it centers in the bar --%>
          <div class="min-w-0 flex-1 [&_.fieldset]:mb-0">
            <.input
              field={@song_form[:name]}
              id="song-name"
              type="text"
              maxlength="60"
              placeholder="Untitled song"
              class="w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-lg font-semibold tracking-tight text-zinc-100 placeholder:text-zinc-600 transition hover:border-zinc-700 focus:border-amber-400 focus:outline-none"
            />
          </div>
          <button
            id="save-song"
            type="submit"
            class="rounded-md bg-amber-400 px-4 py-1.5 text-sm font-semibold text-zinc-900 shadow shadow-amber-400/20 transition hover:bg-amber-300 active:scale-95"
          >
            Save
          </button>
        </.form>

        <.link
          id="new-song"
          patch={~p"/"}
          data-confirm={@dirty? && "Discard unsaved changes?"}
          class="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:border-amber-400/60 hover:bg-zinc-700 active:scale-95"
        >
          New
        </.link>

        <details id="song-menu" class="group relative">
          <summary class="flex cursor-pointer list-none items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:border-amber-400/60 hover:bg-zinc-700">
            Open <.icon name="hero-chevron-down" class="size-4 transition group-open:rotate-180" />
          </summary>
          <ul class="absolute right-0 z-20 mt-2 max-h-80 w-60 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 p-1 shadow-xl shadow-black/60">
            <li :if={@songs == []} class="px-3 py-2 text-sm text-zinc-500">No saved songs yet</li>
            <li :for={song <- @songs}>
              <.link
                id={"open-song-#{song.id}"}
                patch={~p"/songs/#{song.id}"}
                data-confirm={@dirty? && "Discard unsaved changes?"}
                class={[
                  "block truncate rounded-md px-3 py-2 text-sm transition hover:bg-zinc-800",
                  if(@song && @song.id == song.id,
                    do: "text-amber-300",
                    else: "text-zinc-200"
                  )
                ]}
              >
                {song.name}
              </.link>
            </li>
          </ul>
        </details>
      </div>

      <.svelte
        name="Synth"
        id={"synth-#{@mount_key}"}
        ssr={false}
        diff={false}
        props={%{presets: @presets, params: @initial.synth, loops: @initial.loops}}
        socket={@socket}
      />
      <.svelte
        name="DrumMachine"
        id={"drums-#{@mount_key}"}
        ssr={false}
        diff={false}
        props={%{drums: @initial.drums}}
        socket={@socket}
      />
    </Layouts.app>
    """
  end

  @impl true
  def handle_event("save_preset", %{"name" => name, "params" => params}, socket)
      when is_map(params) do
    case Music.save_preset(name, Map.take(params, @param_keys)) do
      {:ok, preset} ->
        {:reply, %{ok: true, id: preset.id, name: preset.name}, assign_presets(socket)}

      {:error, error} ->
        {:reply, %{error: Exception.message(error)}, socket}
    end
  end

  def handle_event("load_preset", %{"id" => id}, socket) do
    case Music.get_preset(id) do
      {:ok, preset} -> {:reply, %{params: preset.params, name: preset.name}, socket}
      {:error, _} -> {:reply, %{error: "Preset not found"}, socket}
    end
  end

  def handle_event("update_synth", %{"params" => params}, socket) when is_map(params) do
    {:noreply, change_doc(socket, :synth, Map.take(params, @param_keys))}
  end

  def handle_event("update_drums", %{"drums" => drums}, socket) when is_map(drums) do
    {:noreply, change_doc(socket, :drums, drums)}
  end

  def handle_event("update_loops", %{"loops" => loops}, socket) when is_list(loops) do
    loops =
      for loop <- loops, is_map(loop) do
        Map.update(loop, "params", %{}, &if(is_map(&1), do: Map.take(&1, @param_keys), else: &1))
      end

    {:noreply, change_doc(socket, :loops, loops)}
  end

  def handle_event("rename", %{"song" => %{"name" => name}}, socket) do
    saved_name = (socket.assigns.song && socket.assigns.song.name) || ""

    {:noreply,
     assign(socket,
       song_form: to_form(%{"name" => name}, as: :song),
       dirty?: socket.assigns.dirty? or name != saved_name
     )}
  end

  def handle_event("save_song", %{"song" => %{"name" => name}}, socket) do
    attrs = Map.put(socket.assigns.doc, :name, name_or_untitled(name, socket.assigns.song))

    result =
      case socket.assigns.song do
        nil -> Music.create_song(attrs)
        song -> Music.update_song(song, attrs)
      end

    case result do
      {:ok, song} ->
        socket =
          socket
          |> assign(song: song, dirty?: false, page_title: song.name)
          |> assign(song_form: to_form(%{"name" => song.name}, as: :song))
          |> assign_songs()
          |> put_flash(:info, "Saved “#{song.name}”")

        {:noreply, push_patch(socket, to: ~p"/songs/#{song.id}")}

      {:error, error} ->
        {:noreply, put_flash(socket, :error, "Couldn't save: " <> Exception.message(error))}
    end
  end

  defp open(socket, song) do
    doc = %{
      synth: song && song.synth,
      drums: song && drums_to_map(song.drums),
      loops: if(song, do: Enum.map(song.loops, &loop_to_map/1), else: [])
    }

    socket
    |> assign(song: song, doc: doc, initial: doc, dirty?: false)
    |> assign(mount_key: if(song, do: song.id, else: "new-#{System.unique_integer([:positive])}"))
    |> assign(page_title: if(song, do: song.name, else: "New song"))
    |> assign(song_form: to_form(%{"name" => song && song.name}, as: :song))
  end

  # Blank name -> first free "Untitled", "Untitled 2", ... (ignoring the open song's own name).
  defp name_or_untitled(name, song) do
    if String.trim(name) == "" do
      taken =
        for s <- Music.list_songs!(), s.id != (song && song.id), into: MapSet.new(), do: s.name

      1
      |> Stream.iterate(&(&1 + 1))
      |> Stream.map(&if(&1 == 1, do: "Untitled", else: "Untitled #{&1}"))
      |> Enum.find(&(&1 not in taken))
    else
      name
    end
  end

  defp change_doc(socket, key, value) do
    assign(socket, doc: Map.put(socket.assigns.doc, key, value), dirty?: true)
  end

  defp drums_to_map(nil), do: nil
  defp drums_to_map(drums), do: Map.take(drums, [:bpm, :volume, :pattern])

  defp loop_to_map(loop), do: Map.take(loop, [:slot, :length, :bpm, :events, :params])

  defp assign_presets(socket) do
    assign(socket, :presets, Enum.map(Music.list_presets!(), &%{id: &1.id, name: &1.name}))
  end

  defp assign_songs(socket) do
    assign(socket, :songs, Enum.map(Music.list_songs!(), &%{id: &1.id, name: &1.name}))
  end
end
