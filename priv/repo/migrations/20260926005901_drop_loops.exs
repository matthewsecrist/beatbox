defmodule Beatbox.Repo.Migrations.DropLoops do
  @moduledoc """
  Loop pads now live inside songs (`songs.loops`); the standalone table is gone.
  Existing rows are discarded.
  """

  use Ecto.Migration

  def up do
    drop_if_exists unique_index(:loops, [:slot], name: "loops_unique_slot_index")
    drop_if_exists table(:loops)
  end

  def down do
    create table(:loops, primary_key: false) do
      add :updated_at, :utc_datetime_usec, null: false
      add :inserted_at, :utc_datetime_usec, null: false
      add :params, :map, null: false
      add :events, {:array, :map}, null: false
      add :length, :float, null: false
      add :slot, :bigint, null: false
      add :id, :uuid, null: false, primary_key: true
    end

    create unique_index(:loops, [:slot], name: "loops_unique_slot_index")
  end
end
