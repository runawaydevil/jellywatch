using System;
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
/// Subscribes to Jellyfin library events and owns the auto-sync schedule.
/// On startup: waits 2 minutes for the library to settle, then pushes.
/// Weekly: pushes every 7 days unconditionally.
/// Event-driven: bumps the debouncer on any supported media change.
/// No manual trigger is exposed to the admin UI.
/// </summary>
public class LibraryEventListener : IHostedService, IDisposable
{
    private readonly ILibraryManager _libraryManager;
    private readonly Debouncer _debouncer;
    private readonly ILogger _logger;
    private Timer? _weeklyTimer;
    private CancellationTokenSource? _startupCts;

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
        _logger.LogInformation("JellyWatch subscribed to library events");

        // Initial sync: wait 2 minutes so Jellyfin finishes loading the library,
        // then start the weekly timer at the same time.
        _startupCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        var token = _startupCts.Token;
        _ = Task.Run(async () =>
        {
            try
            {
                await Task.Delay(TimeSpan.FromMinutes(2), token).ConfigureAwait(false);
                _logger.LogInformation("JellyWatch: running startup sync");
                _debouncer.Bump();
                _weeklyTimer = new Timer(_ =>
                {
                    _logger.LogInformation("JellyWatch: running weekly sync");
                    _debouncer.Bump();
                }, null, TimeSpan.FromDays(7), TimeSpan.FromDays(7));
            }
            catch (OperationCanceledException)
            {
                // Server is shutting down before the 2-minute window elapsed; skip.
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "JellyWatch: startup sync failed");
            }
        }, token);

        return Task.CompletedTask;
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        _startupCts?.Cancel();
        _weeklyTimer?.Dispose();
        _libraryManager.ItemAdded -= OnItemChanged;
        _libraryManager.ItemUpdated -= OnItemChanged;
        _libraryManager.ItemRemoved -= OnItemChanged;
        _logger.LogInformation("JellyWatch unsubscribed; flushing pending debounce");
        await _debouncer.FlushAsync().ConfigureAwait(false);
    }

    public void Dispose()
    {
        _weeklyTimer?.Dispose();
        _startupCts?.Dispose();
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
