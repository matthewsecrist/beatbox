defmodule BeatboxWeb.PageController do
  use BeatboxWeb, :controller

  def home(conn, _params) do
    render(conn, :home)
  end
end
