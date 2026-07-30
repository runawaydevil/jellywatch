using System;
using MediaBrowser.Controller;
using MediaBrowser.Controller.Plugins;
using Microsoft.Extensions.DependencyInjection;

namespace Jellyfin.Plugin.JellyWatch;

/// <summary>
/// Auto-discovered by Jellyfin's plugin loader on startup. Registers the
/// catalog builder, GitHub pusher, and the named HttpClient. The weekly
/// sync itself is a Jellyfin IScheduledTask (CatalogSyncTask), which the
/// task manager discovers by assembly reflection - no registration here.
/// </summary>
public class PluginServiceRegistrator : IPluginServiceRegistrator
{
    public void RegisterServices(IServiceCollection serviceCollection, IServerApplicationHost applicationHost)
    {
        serviceCollection.AddSingleton<MediaCatalogBuilder>();
        serviceCollection.AddSingleton<GitHubPusher>();

        serviceCollection.AddHttpClient("github", client =>
        {
            client.BaseAddress = new Uri("https://api.github.com/");
            client.DefaultRequestHeaders.Add("User-Agent", "jellywatch/0.2.0");
            client.DefaultRequestHeaders.Add("X-GitHub-Api-Version", "2022-11-28");
            client.Timeout = TimeSpan.FromSeconds(30);
        });
    }
}
