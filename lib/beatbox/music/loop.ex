defmodule Beatbox.Music.Loop do
  @moduledoc "One recorded loop pad, embedded in a `Beatbox.Music.Song`."
  use Ash.Resource, data_layer: :embedded

  attributes do
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
  end
end
