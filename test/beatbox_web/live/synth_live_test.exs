defmodule BeatboxWeb.SynthLiveTest do
  use BeatboxWeb.ConnCase, async: true

  import Phoenix.LiveViewTest

  test "saves and loads presets, dropping unknown params", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")
    assert has_element?(view, "#synth")
    assert has_element?(view, "#drums")

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

  test "saves a loop pad with only known params, clears it, and restores saved pads on mount",
       %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")

    render_hook(view, "save_loop", %{
      "slot" => 2,
      "length" => 1.5,
      "events" => [%{"t" => 0, "midi" => 60, "on" => true}],
      "params" => %{"osc1_wave" => "sine", "evil" => "x"}
    })

    assert_reply(view, %{ok: true})
    assert [%{slot: 2, params: %{"osc1_wave" => "sine"} = params}] = Beatbox.Music.list_loops!()
    refute Map.has_key?(params, "evil")

    {:ok, view, _html} = live(conn, ~p"/")
    assert %{"loops" => [%{"slot" => 2}]} = synth_props(view)

    render_hook(view, "clear_loop", %{"slot" => 2})
    assert_reply(view, %{ok: true})
    assert Beatbox.Music.list_loops!() == []
  end

  test "an invalid loop replies with an error so the pad can roll back", %{conn: conn} do
    {:ok, view, _html} = live(conn, ~p"/")

    render_hook(view, "save_loop", %{
      "slot" => 0,
      "length" => 1.0,
      "events" => [%{"t" => 0, "midi" => 128, "on" => true}],
      "params" => %{}
    })

    assert_reply(view, %{error: _})
    assert Beatbox.Music.list_loops!() == []
  end

  defp synth_props(view) do
    view
    |> element("#synth")
    |> render()
    |> LazyHTML.from_fragment()
    |> LazyHTML.attribute("data-props")
    |> hd()
    |> JSON.decode!()
  end
end
