# Seeds built-in songs. Run with `mix run priv/repo/seeds.exs` (also part of
# `mix setup` / `mix ash.setup`). Idempotent: a song that already exists by name is
# left alone, so edits made in the app are never overwritten.
#
# Skipped under MIX_ENV=test: the `test` alias runs `ash.setup` (and so these
# seeds) outside the SQL sandbox, and seeded rows would leak into every test.

alias Beatbox.Music

if Mix.env() != :test do
  existing = MapSet.new(Music.list_songs!(), & &1.name)

  # Each file is a song exported from the app: name, synth, drums, loops, arrangement.
  for path <- Path.wildcard(Path.join(__DIR__, "seeds/*.json")) do
    song = path |> File.read!() |> JSON.decode!()

    if song["name"] in existing do
      IO.puts("Seed song “#{song["name"]}” already exists, skipping")
    else
      Music.create_song!(song)
      IO.puts("Seeded song “#{song["name"]}”")
    end
  end
end
