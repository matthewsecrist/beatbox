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
end
