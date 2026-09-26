defmodule Beatbox.Music do
  use Ash.Domain, otp_app: :beatbox

  resources do
    resource Beatbox.Music.Preset do
      define :list_presets, action: :list
      define :save_preset, action: :save, args: [:name, :params]
      define :get_preset, action: :read, get_by: [:id]
    end
  end
end
