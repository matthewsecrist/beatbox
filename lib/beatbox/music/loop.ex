defmodule Beatbox.Music.Loop do
  use Ash.Resource,
    otp_app: :beatbox,
    domain: Beatbox.Music,
    data_layer: AshSqlite.DataLayer

  sqlite do
    table "loops"
    repo Beatbox.Repo
  end

  actions do
    defaults [:read, :destroy]

    read :list do
      prepare build(sort: [slot: :asc])
    end

    create :save do
      accept [:slot, :length, :events, :params]
      upsert? true
      upsert_identity :unique_slot
      upsert_fields [:length, :events, :params, :updated_at]
    end
  end

  attributes do
    uuid_primary_key :id

    attribute :slot, :integer,
      allow_nil?: false,
      public?: true,
      constraints: [min: 0, max: 7]

    # Seconds; one full cycle of the loop.
    attribute :length, :float,
      allow_nil?: false,
      public?: true,
      constraints: [min: 0.1, max: 300.0]

    attribute :events, {:array, :map},
      allow_nil?: false,
      public?: true,
      constraints: [
        max_length: 4000,
        items: [
          fields: [
            t: [type: :float, allow_nil?: false, constraints: [min: 0.0]],
            midi: [type: :integer, allow_nil?: false, constraints: [min: 0, max: 127]],
            on: [type: :boolean, allow_nil?: false]
          ]
        ]
      ]

    # Synth params captured at record time, so the loop keeps its own sound.
    attribute :params, :map, allow_nil?: false, public?: true

    timestamps()
  end

  identities do
    identity :unique_slot, [:slot]
  end
end
