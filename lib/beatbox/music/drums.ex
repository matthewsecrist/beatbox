defmodule Beatbox.Music.Drums do
  @moduledoc "Drum machine state (tempo, level, patterns A-D of 16 steps), embedded in a song."
  use Ash.Resource, data_layer: :embedded

  @step_list [type: {:array, :boolean}, constraints: [max_length: 16]]

  attributes do
    attribute :bpm, :integer, allow_nil?: false, public?: true, constraints: [min: 60, max: 200]
    attribute :volume, :float, allow_nil?: false, public?: true, constraints: [min: 0.0, max: 1.0]

    # Patterns A-D (index 0-3); arrangement sections pick one by index.
    attribute :patterns, {:array, :map},
      allow_nil?: false,
      public?: true,
      constraints: [
        min_length: 1,
        max_length: 4,
        items: [
          fields: [
            kick: @step_list,
            snare: @step_list,
            clap: @step_list,
            chat: @step_list,
            ohat: @step_list,
            tom: @step_list
          ]
        ]
      ]
  end
end
