using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using MediaBrowser.Model.Tasks;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.JellyWatch;

/// <summary>
/// The one and only sync trigger: a weekly scheduled task that builds the
/// catalog snapshot and pushes it to GitHub. Default schedule is Friday
/// 18:00 in the server's local time zone.
///
/// Jellyfin's task manager auto-discovers this by scanning the plugin
/// assembly for IScheduledTask (no DI registration needed); the constructor
/// dependencies are resolved from the container. Admins can retune the day
/// and time, or add extra triggers, from the "Scheduled Tasks" dashboard
/// without touching code. Failures propagate so the dashboard shows the
/// task as failed with the underlying error rather than swallowing it.
/// </summary>
public class CatalogSyncTask : IScheduledTask
{
    private readonly MediaCatalogBuilder _builder;
    private readonly GitHubPusher _pusher;
    private readonly ILogger _logger;

    public CatalogSyncTask(MediaCatalogBuilder builder, GitHubPusher pusher, ILoggerFactory loggerFactory)
    {
        _builder = builder;
        _pusher = pusher;
        _logger = loggerFactory.CreateLogger("JellyWatch");
    }

    /// <inheritdoc />
    public string Name => "JellyWatch catalog sync";

    /// <inheritdoc />
    public string Key => "JellyWatchCatalogSync";

    /// <inheritdoc />
    public string Description => "Builds the media catalog snapshot and pushes it to the configured GitHub repo. Runs weekly (Friday 18:00 by default).";

    /// <inheritdoc />
    public string Category => "JellyWatch";

    /// <inheritdoc />
    public async Task ExecuteAsync(IProgress<double> progress, CancellationToken cancellationToken)
    {
        _logger.LogInformation("JellyWatch: scheduled catalog sync starting");
        progress.Report(0);

        var payload = await _builder.BuildAsync(cancellationToken).ConfigureAwait(false);
        progress.Report(50);

        await _pusher.PushAsync(payload, cancellationToken).ConfigureAwait(false);
        progress.Report(100);

        _logger.LogInformation("JellyWatch: scheduled catalog sync complete");
    }

    /// <inheritdoc />
    public IEnumerable<TaskTriggerInfo> GetDefaultTriggers() => new[]
    {
        new TaskTriggerInfo
        {
            Type = TaskTriggerInfoType.WeeklyTrigger,
            DayOfWeek = DayOfWeek.Friday,
            TimeOfDayTicks = TimeSpan.FromHours(18).Ticks,
        },
    };
}
