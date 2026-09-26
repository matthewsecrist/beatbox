defmodule Beatbox.Music.Song do
  @moduledoc "A saved session: synth settings, drum machine and loop pads."
  use Ash.Resource,
    otp_app: :beatbox,
    domain: Beatbox.Music,
    data_layer: AshSqlite.DataLayer

  sqlite do
    table "songs"
    repo Beatbox.Repo
  end

  actions do
    defaults [:read]

    read :list do
      prepare build(sort: [name: :asc])
    end

    create :create do
      accept [:name, :synth, :drums, :loops, :arrangement]
    end

    update :update do
      accept [:name, :synth, :drums, :loops, :arrangement]
      require_atomic? false
    end
  end

  attributes do
    uuid_primary_key :id

    attribute :name, :string,
      allow_nil?: false,
      public?: true,
      constraints: [min_length: 1, max_length: 60, trim?: true]

    # nil means "defaults" for synth and drums.
    attribute :synth, :map, public?: true
    attribute :drums, Beatbox.Music.Drums, public?: true

    attribute :loops, {:array, Beatbox.Music.Loop},
      allow_nil?: false,
      default: [],
      public?: true,
      constraints: [max_length: 8]

    # Sections played in order by "Play song".
    attribute :arrangement, {:array, Beatbox.Music.Section},
      allow_nil?: false,
      default: [],
      public?: true,
      constraints: [max_length: 64]

    timestamps()
  end

  identities do
    identity :unique_name, [:name]
  end
end
