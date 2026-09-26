defmodule Beatbox.Repo.Migrations.DrumPatterns do
  @moduledoc """
  Drums moved from one `pattern` to `patterns` (A-D). Existing songs keep their
  pattern as pattern A. `songs.drums` is JSON text, so this is a data-only change.
  """

  use Ecto.Migration

  def up do
    execute """
    UPDATE songs
    SET drums = json_remove(
      json_set(drums, '$.patterns', json_array(json(json_extract(drums, '$.pattern')))),
      '$.pattern'
    )
    WHERE json_extract(drums, '$.pattern') IS NOT NULL
    """
  end

  def down do
    execute """
    UPDATE songs
    SET drums = json_remove(
      json_set(drums, '$.pattern', json(json_extract(drums, '$.patterns[0]'))),
      '$.patterns'
    )
    WHERE json_extract(drums, '$.patterns') IS NOT NULL
    """
  end
end
