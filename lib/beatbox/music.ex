defmodule Beatbox.Music do
  use Ash.Domain, otp_app: :beatbox

  resources do
    resource Beatbox.Music.Preset do
      define :list_presets, action: :list
      define :save_preset, action: :save, args: [:name, :params]
      define :get_preset, action: :read, get_by: [:id]
    end

    resource Beatbox.Music.Loop do
      define :list_loops, action: :list
      define :save_loop, action: :save, args: [:slot, :length, :events, :params]
      define :get_loop_by_slot, action: :read, get_by: [:slot]
      define :clear_loop, action: :destroy
    end
  end
end
