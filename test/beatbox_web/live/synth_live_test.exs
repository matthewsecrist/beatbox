defmodule BeatboxWeb.SynthLiveTest do
  use BeatboxWeb.ConnCase

  import Phoenix.LiveViewTest

  alias Beatbox.Music

  test "saves and loads presets, dropping unknown params", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")
    assert has_element?(view, "[data-name=Synth]")
    assert has_element?(view, "[data-name=DrumMachine]")

    render_hook(view, "save_preset", %{
      "name" => "Lead",
      "params" => %{"volume" => 0.4, "evil" => "x"}
    })

    assert_reply(view, %{ok: true, id: id})

    render_hook(view, "load_preset", %{"id" => id})
    assert_reply(view, %{params: params, name: "Lead"})
    assert params == %{"volume" => 0.4}
  end

  test "loading a missing preset replies with an error", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")

    render_hook(view, "load_preset", %{"id" => Ecto.UUID.generate()})
    assert_reply(view, %{error: "Preset not found"})
  end

  test "saves the whole session as a song and reopens it", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")
    push_session(view)

    view |> form("#song-form", song: %{name: "Jam"}) |> render_submit()

    assert [%{id: id, name: "Jam"}] = Music.list_songs!()
    assert_patch(view, ~p"/songs/#{id}")

    {:ok, song} = Music.get_song(id)
    assert song.synth == %{"filter_cutoff" => 300}
    assert %{bpm: 140} = song.drums
    assert [%{slot: 2, params: %{"osc1_wave" => "sine"} = loop_params}] = song.loops
    refute Map.has_key?(loop_params, "evil")

    {:ok, reopened, _html} = live(conn, ~p"/songs/#{id}")

    assert %{"params" => %{"filter_cutoff" => 300}, "loops" => [%{"slot" => 2}]} =
             props(reopened, "Synth")

    assert %{"drums" => %{"bpm" => 140}} = props(reopened, "DrumMachine")
  end

  test "saving again updates the open song instead of creating another", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")
    view |> form("#song-form", song: %{name: "Jam"}) |> render_submit()

    render_hook(view, "update_drums", %{"drums" => drums(120)})
    view |> form("#song-form", song: %{name: "Jam v2"}) |> render_submit()

    assert [%{name: "Jam v2", drums: %{bpm: 120}}] = Music.list_songs!()
  end

  test "New and Open remount the instruments with that song's state", %{conn: conn} do
    song = Music.create_song!(%{name: "Jam", drums: drums(150)})
    {:ok, view, _html} = live(conn, ~p"/")
    push_session(view)
    new_id = component_id(view, "Synth")

    view |> element("#open-song-#{song.id}") |> render_click()
    assert_patch(view, ~p"/songs/#{song.id}")
    assert %{"drums" => %{"bpm" => 150}} = props(view, "DrumMachine")
    refute component_id(view, "Synth") == new_id

    view |> element("#new-song") |> render_click()
    assert_patch(view, ~p"/")
    assert %{"drums" => nil} = props(view, "DrumMachine")
    assert %{"params" => nil, "loops" => []} = props(view, "Synth")
  end

  test "an invalid session isn't saved and shows why", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")

    render_hook(view, "update_loops", %{
      "loops" => [
        %{
          "slot" => 0,
          "length" => 1.0,
          "params" => %{},
          "events" => [%{"t" => 0, "midi" => 128, "on" => true}]
        }
      ]
    })

    view |> form("#song-form", song: %{name: "Broken"}) |> render_submit()

    assert has_element?(view, "#flash-error")
    assert Music.list_songs!() == []
  end

  test "saving without a name picks the next free Untitled name", %{conn: conn} do
    for _ <- 1..2 do
      {:ok, view, _html} = live(conn, ~p"/")
      view |> form("#song-form", song: %{name: "  "}) |> render_submit()
      assert has_element?(view, "#flash-info")
    end

    assert ["Untitled", "Untitled 2"] == Enum.map(Music.list_songs!(), & &1.name)
  end

  test "renaming the open song counts as an unsaved change", %{conn: conn} do
    song = Music.create_song!(%{name: "Jam"})
    {:ok, view, _html} = live(conn, ~p"/songs/#{song.id}")
    assert has_element?(view, "#song-status[data-dirty=false]")
    refute has_element?(view, "#new-song[data-confirm]")

    view |> form("#song-form", song: %{name: "Jam v2"}) |> render_change()

    assert has_element?(view, "#song-status[data-dirty=true]")
    assert has_element?(view, "#new-song[data-confirm]")
  end

  test "opening a missing song goes back to a new song", %{conn: conn} do
    assert {:error, {:live_redirect, %{to: "/"}}} =
             live(conn, ~p"/songs/#{Ecto.UUID.generate()}")
  end

  defp push_session(view) do
    render_hook(view, "update_synth", %{"params" => %{"filter_cutoff" => 300, "evil" => "x"}})
    render_hook(view, "update_drums", %{"drums" => drums(140)})

    render_hook(view, "update_loops", %{
      "loops" => [
        %{
          "slot" => 2,
          "length" => 1.5,
          "events" => [%{"t" => 0, "midi" => 60, "on" => true}],
          "params" => %{"osc1_wave" => "sine", "evil" => "x"}
        }
      ]
    })
  end

  defp drums(bpm), do: %{"bpm" => bpm, "volume" => 0.8, "pattern" => %{"kick" => [true]}}

  defp component(view, name) do
    view |> element("[data-name=#{name}]") |> render() |> LazyHTML.from_fragment()
  end

  defp props(view, name) do
    view |> component(name) |> LazyHTML.attribute("data-props") |> hd() |> JSON.decode!()
  end

  defp component_id(view, name), do: view |> component(name) |> LazyHTML.attribute("id") |> hd()
end
