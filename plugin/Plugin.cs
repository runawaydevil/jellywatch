using System;
using System.Collections.Generic;
using System.Globalization;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace Jellyfin.Plugin.JellyWatch;

/// <summary>
/// Plugin entrypoint. Identity (Name, Id, Description) and the embedded
/// configPage.html resource registration.
/// </summary>
public class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
{
    public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
        : base(applicationPaths, xmlSerializer)
    {
        Instance = this;
    }

    /// <inheritdoc />
    public override string Name => "JellyWatch";

    /// <inheritdoc />
    public override Guid Id => Guid.Parse("a12a453e-31f7-46e2-9968-d92580109f24");

    /// <inheritdoc />
    public override string Description => "JellyWatch: mirrors the full media library (movies, shows, music, books and more) to a GitHub-hosted JSON for off-network browsing.";

    /// <summary>
    /// Static accessor so non-DI sites (the scheduled task entry, the
    /// debouncer, the pusher) can read the latest configuration without
    /// having to capture it at construction time.
    /// </summary>
    public static Plugin? Instance { get; private set; }

    /// <inheritdoc />
    public IEnumerable<PluginPageInfo> GetPages() => new[]
    {
        new PluginPageInfo
        {
            Name = Name,
            EmbeddedResourcePath = string.Format(
                CultureInfo.InvariantCulture,
                "{0}.Web.configPage.html",
                GetType().Namespace),
        },
    };
}
