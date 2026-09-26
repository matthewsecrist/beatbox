defmodule Beatbox.Music.Section do
  @moduledoc "One section of a song's arrangement: which pads and drums play, for how many bars."
  use Ash.Resource, data_layer: :embedded

  attributes do
    attribute :name, :string, public?: true, constraints: [max_length: 30, trim?: true]
    attribute :bars, :integer, allow_nil?: false, public?: true, constraints: [min: 1, max: 64]
    attribute :drums, :boolean, allow_nil?: false, default: false, public?: true

    # Loop pad slots (0-7) playing in this section.
    attribute :pads, {:array, :integer},
      allow_nil?: false,
      default: [],
      public?: true,
      constraints: [max_length: 8, items: [min: 0, max: 7]]
  end
end
