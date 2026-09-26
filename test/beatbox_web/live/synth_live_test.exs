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
end
