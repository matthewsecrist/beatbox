defmodule Beatbox.Music.Preset do
  use Ash.Resource,
    otp_app: :beatbox,
    domain: Beatbox.Music,
    data_layer: AshSqlite.DataLayer

  sqlite do
    table "presets"
    repo Beatbox.Repo
  end

  actions do
    defaults [:read]

    read :list do
      prepare build(sort: [name: :asc])
    end

    create :save do
      accept [:name, :params]
      upsert? true
      upsert_identity :unique_name
      upsert_fields [:params, :updated_at]
    end
  end

  attributes do
    uuid_primary_key :id

    attribute :name, :string,
      allow_nil?: false,
      public?: true,
      constraints: [min_length: 1, max_length: 60, trim?: true]

    attribute :params, :map, allow_nil?: false, public?: true

    timestamps()
  end

  identities do
    identity :unique_name, [:name]
  end
end
