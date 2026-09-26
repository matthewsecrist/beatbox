defmodule Beatbox.Application do
  # See https://elixir.hexdocs.pm/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    node_js_children =
      if Application.get_env(:live_svelte, :ssr_module, nil) == LiveSvelte.SSR.NodeJS do
        [{NodeJS.Supervisor, [path: LiveSvelte.SSR.NodeJS.server_path(), pool_size: 4]}]
      else
        []
      end

    children = node_js_children ++ [
      BeatboxWeb.Telemetry,
      Beatbox.Repo,
      {Ecto.Migrator,
       repos: Application.fetch_env!(:beatbox, :ecto_repos), skip: skip_migrations?()},
      {DNSCluster, query: Application.get_env(:beatbox, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: Beatbox.PubSub},
      # Start a worker by calling: Beatbox.Worker.start_link(arg)
      # {Beatbox.Worker, arg},
      # Start to serve requests, typically the last entry
      BeatboxWeb.Endpoint
    ]

    # See https://elixir.hexdocs.pm/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: Beatbox.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    BeatboxWeb.Endpoint.config_change(changed, removed)
    :ok
  end

  defp skip_migrations?() do
    # By default, sqlite migrations are run when using a release
    System.get_env("RELEASE_NAME") == nil
  end
end
