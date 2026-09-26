defmodule BeatboxWeb.SynthLive do
  use BeatboxWeb, :live_view

  @param_keys ~w(osc1_wave osc1_octave osc1_detune osc1_level osc2_wave osc2_octave osc2_detune osc2_level filter_cutoff filter_resonance attack decay sustain release volume)

  @impl true
  def mount(_params, _session, socket) do
    {:ok, socket |> assign(:page_title, "Synth") |> assign_presets()}
  end

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash}>
      <.svelte name="Synth" id="synth" ssr={false} props={%{presets: @presets}} socket={@socket} />
      <.svelte name="DrumMachine" id="drums" ssr={false} socket={@socket} />
    </Layouts.app>
    """
  end

  @impl true
  def handle_event("save_preset", %{"name" => name, "params" => params}, socket)
      when is_map(params) do
    case Beatbox.Music.save_preset(name, Map.take(params, @param_keys)) do
      {:ok, preset} ->
        {:reply, %{ok: true, id: preset.id, name: preset.name}, assign_presets(socket)}

      {:error, error} ->
        {:reply, %{error: Exception.message(error)}, socket}
    end
  end

  def handle_event("load_preset", %{"id" => id}, socket) do
    case Beatbox.Music.get_preset(id) do
      {:ok, preset} -> {:reply, %{params: preset.params, name: preset.name}, socket}
      {:error, _} -> {:reply, %{error: "Preset not found"}, socket}
    end
  end

  defp assign_presets(socket) do
    assign(
      socket,
      :presets,
      Enum.map(Beatbox.Music.list_presets!(), &%{id: &1.id, name: &1.name})
    )
  end
end
