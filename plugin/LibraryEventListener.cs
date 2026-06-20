using System.Threading;
using System.Threading.Tasks;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.Audio;
using MediaBrowser.Controller.Entities.Movies;
using MediaBrowser.Controller.Entities.TV;
using MediaBrowser.Controller.Library;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.JellyWatch;

/// <summary>
/// Subscribes to ILibraryManager.ItemAdded/Updated/Removed at startup,
/// filters to supported media types, and bumps the debouncer. Handlers
/// return immediately; the actual build+push work happens on a background
/// Task spawned by the debouncer.
/// </summary>
public class LibraryEventListener : IHostedService
{
    private readonly ILibraryManager _libraryManager;
    private readonly Debouncer _debouncer;
    private readonly ILogger _logger;

    public LibraryEventListener(ILibraryManager libraryManager, Debouncer debouncer, ILoggerFactory loggerFactory)
    {
        _libraryManager = libraryManager;
        _debouncer = debouncer;
        _logger = loggerFactory.CreateLogger("JellyWatch");
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        _libraryManager.ItemAdded += OnItemChanged;
        _libraryManager.ItemUpdated += OnItemChanged;
        _libraryManager.ItemRemoved += OnItemChanged;
        _logger.LogInformation("LibraryEventListener subscribed (ItemAdded/Updated/Removed, all supported media types)");
        return Task.CompletedTask;
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        _libraryManager.ItemAdded -= OnItemChanged;
        _libraryManager.ItemUpdated -= OnItemChanged;
        _libraryManager.ItemRemoved -= OnItemChanged;
        _logger.LogInformation("LibraryEventListener unsubscribed; flushing pending debounce");
        await _debouncer.FlushAsync().ConfigureAwait(false);
    }

    private void OnItemChanged(object? sender, ItemChangeEventArgs e)
    {
        if (e.Item is Movie
            or Series
            or Episode
            or Audio
            or MusicAlbum
            or MusicArtist
            or Book
            or MusicVideo
            or AudioBook)
        {
            _debouncer.Bump();
        }
    }
}
