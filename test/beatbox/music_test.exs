defmodule Beatbox.MusicTest do
  use Beatbox.DataCase, async: true

  alias Beatbox.Music

  test "saving under an existing name overwrites the preset" do
    {:ok, _} = Music.save_preset("Bass", %{"volume" => 0.5})
    {:ok, _} = Music.save_preset("Bass", %{"volume" => 0.9})

    assert [%{name: "Bass", params: %{"volume" => 0.9}}] = Music.list_presets!()
  end

  test "blank names are rejected" do
    assert {:error, %Ash.Error.Invalid{}} = Music.save_preset("   ", %{})
  end

  test "presets are listed by name" do
    for name <- ~w(Pad Arp Lead), do: Music.save_preset!(name, %{})

    assert ~w(Arp Lead Pad) == Enum.map(Music.list_presets!(), & &1.name)
  end

  test "saving to an occupied loop slot replaces it" do
    Music.save_loop!(3, 1.0, [%{"t" => 0, "midi" => 60, "on" => true}], %{})
    Music.save_loop!(3, 2.0, [%{"t" => 0, "midi" => 64, "on" => true}], %{})

    assert [%{slot: 3, length: 2.0, events: [%{midi: 64}]}] = Music.list_loops!()
  end

  test "loops reject notes outside the MIDI range and slots outside the pad grid" do
    assert {:error, %Ash.Error.Invalid{}} =
             Music.save_loop(0, 1.0, [%{"t" => 0, "midi" => 128, "on" => true}], %{})

    assert {:error, %Ash.Error.Invalid{}} = Music.save_loop(8, 1.0, [], %{})
  end
end
