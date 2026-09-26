defmodule Beatbox.MusicTest do
  use Beatbox.DataCase

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

  test "songs keep their loops and drums, and reject invalid ones" do
    loop = %{
      "slot" => 3,
      "length" => 2.0,
      "params" => %{},
      "events" => [%{"t" => 0, "midi" => 64, "on" => true}]
    }

    drums = %{"bpm" => 140, "volume" => 0.5, "pattern" => %{"kick" => [true, false]}}

    song = Music.create_song!(%{name: "Jam", loops: [loop], drums: drums})

    assert {:ok, %{loops: [%{slot: 3, events: [%{midi: 64}]}], drums: %{bpm: 140}}} =
             Music.get_song(song.id)

    bad_note = put_in(loop, ["events"], [%{"t" => 0, "midi" => 128, "on" => true}])
    assert {:error, %Ash.Error.Invalid{}} = Music.update_song(song, %{loops: [bad_note]})

    assert {:error, %Ash.Error.Invalid{}} =
             Music.update_song(song, %{arrangement: [%{"bars" => 4, "pads" => [8]}]})

    assert {:error, %Ash.Error.Invalid{}} =
             Music.update_song(song, %{loops: [%{loop | "slot" => 8}]})

    assert {:error, %Ash.Error.Invalid{}} =
             Music.update_song(song, %{drums: %{drums | "bpm" => 999}})
  end

  test "song names are unique" do
    Music.create_song!(%{name: "Jam"})
    assert {:error, %Ash.Error.Invalid{}} = Music.create_song(%{name: "Jam"})
  end
end
