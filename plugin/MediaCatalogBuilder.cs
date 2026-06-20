using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Jellyfin.Data.Enums;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.Audio;
using MediaBrowser.Controller.Entities.Movies;
using MediaBrowser.Controller.Entities.TV;
using MediaBrowser.Controller.Library;

namespace Jellyfin.Plugin.JellyWatch;

/// <summary>
/// Builds the JSON payload for the current library snapshot across all
/// supported media types. Schema: generated_at, plugin_version, counts
/// (per type), items (flat array with a "type" discriminator field).
/// </summary>
public class MediaCatalogBuilder
{
    private readonly ILibraryManager _libraryManager;

    public MediaCatalogBuilder(ILibraryManager libraryManager)
    {
        _libraryManager = libraryManager;
    }

    public Task<byte[]> BuildAsync(CancellationToken cancellationToken)
    {
        var query = new InternalItemsQuery
        {
            IncludeItemTypes = new[]
            {
                BaseItemKind.Movie,
                BaseItemKind.Series,
                BaseItemKind.Episode,
                BaseItemKind.Audio,
                BaseItemKind.MusicAlbum,
                BaseItemKind.MusicArtist,
                BaseItemKind.Book,
                BaseItemKind.MusicVideo,
                BaseItemKind.AudioBook,
            },
            Recursive = true,
            EnableTotalRecordCount = false,
        };

        var items = _libraryManager.GetItemList(query)
            .Select(ProjectItem)
            .Where(x => x is not null)
            .ToList();

        var counts = new SortedDictionary<string, int>(StringComparer.Ordinal);
        foreach (var item in items)
        {
            if (item!.TryGetValue("type", out var t) && t is string typeStr)
            {
                counts.TryGetValue(typeStr, out var c);
                counts[typeStr] = c + 1;
            }
        }

        var payload = new
        {
            generated_at = DateTime.UtcNow.ToString("O"),
            plugin_version = "0.2.0",
            counts,
            items,
        };

        var options = new JsonSerializerOptions
        {
            WriteIndented = true,
            Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        };
        var json = JsonSerializer.Serialize(payload, options);
        return Task.FromResult(Encoding.UTF8.GetBytes(json));
    }

    private static Dictionary<string, object?>? ProjectItem(BaseItem item) => item switch
    {
        AudioBook ab   => ProjectAudioBook(ab),
        MusicVideo mv  => ProjectMusicVideo(mv),
        Movie m        => ProjectMovie(m),
        Series s       => ProjectSeries(s),
        Episode ep     => ProjectEpisode(ep),
        MusicArtist ar => ProjectMusicArtist(ar),
        MusicAlbum al  => ProjectMusicAlbum(al),
        Audio a        => ProjectAudio(a),
        Book b         => ProjectBook(b),
        _              => null,
    };

    private static string? ProviderId(BaseItem item, string key)
        => item.ProviderIds.TryGetValue(key, out var v) ? v : null;

    private static string DateAdded(BaseItem item)
        => item.DateCreated.ToUniversalTime().ToString("O");

    private static long? RuntimeSeconds(BaseItem item)
        => item.RunTimeTicks.HasValue ? (long?)(item.RunTimeTicks.Value / 10_000_000) : null;

    private static Dictionary<string, object?> ProjectMovie(Movie m) => new()
    {
        ["type"] = "movie",
        ["id"] = m.Id.ToString("N"),
        ["title"] = m.Name,
        ["year"] = m.ProductionYear,
        ["runtime_seconds"] = RuntimeSeconds(m),
        ["genres"] = m.Genres ?? Array.Empty<string>(),
        ["date_added"] = DateAdded(m),
        ["tmdb_id"] = ProviderId(m, "Tmdb"),
        ["imdb_id"] = ProviderId(m, "Imdb"),
    };

    private static Dictionary<string, object?> ProjectSeries(Series s) => new()
    {
        ["type"] = "series",
        ["id"] = s.Id.ToString("N"),
        ["title"] = s.Name,
        ["year"] = s.ProductionYear,
        ["genres"] = s.Genres ?? Array.Empty<string>(),
        ["date_added"] = DateAdded(s),
        ["tvdb_id"] = ProviderId(s, "Tvdb"),
        ["tmdb_id"] = ProviderId(s, "Tmdb"),
    };

    private static Dictionary<string, object?> ProjectEpisode(Episode ep) => new()
    {
        ["type"] = "episode",
        ["id"] = ep.Id.ToString("N"),
        ["title"] = ep.Name,
        ["series_name"] = ep.SeriesName,
        ["season"] = ep.ParentIndexNumber,
        ["episode"] = ep.IndexNumber,
        ["year"] = ep.ProductionYear,
        ["runtime_seconds"] = RuntimeSeconds(ep),
        ["date_added"] = DateAdded(ep),
        ["tvdb_id"] = ProviderId(ep, "Tvdb"),
    };

    private static Dictionary<string, object?> ProjectAudio(Audio a) => new()
    {
        ["type"] = "audio",
        ["id"] = a.Id.ToString("N"),
        ["title"] = a.Name,
        ["artist"] = a.Artists?.FirstOrDefault(),
        ["album_artist"] = a.AlbumArtists?.FirstOrDefault(),
        ["album"] = a.Album,
        ["track_number"] = a.IndexNumber,
        ["disc_number"] = a.ParentIndexNumber,
        ["year"] = a.ProductionYear,
        ["runtime_seconds"] = RuntimeSeconds(a),
        ["genres"] = a.Genres ?? Array.Empty<string>(),
        ["date_added"] = DateAdded(a),
    };

    private static Dictionary<string, object?> ProjectMusicAlbum(MusicAlbum al) => new()
    {
        ["type"] = "music_album",
        ["id"] = al.Id.ToString("N"),
        ["title"] = al.Name,
        ["album_artist"] = al.AlbumArtists?.FirstOrDefault(),
        ["year"] = al.ProductionYear,
        ["genres"] = al.Genres ?? Array.Empty<string>(),
        ["date_added"] = DateAdded(al),
    };

    private static Dictionary<string, object?> ProjectMusicArtist(MusicArtist ar) => new()
    {
        ["type"] = "music_artist",
        ["id"] = ar.Id.ToString("N"),
        ["title"] = ar.Name,
        ["date_added"] = DateAdded(ar),
    };

    private static Dictionary<string, object?> ProjectBook(Book b) => new()
    {
        ["type"] = "book",
        ["id"] = b.Id.ToString("N"),
        ["title"] = b.Name,
        ["year"] = b.ProductionYear,
        ["genres"] = b.Genres ?? Array.Empty<string>(),
        ["date_added"] = DateAdded(b),
    };

    private static Dictionary<string, object?> ProjectMusicVideo(MusicVideo mv) => new()
    {
        ["type"] = "music_video",
        ["id"] = mv.Id.ToString("N"),
        ["title"] = mv.Name,
        ["artist"] = mv.Artists?.FirstOrDefault(),
        ["year"] = mv.ProductionYear,
        ["runtime_seconds"] = RuntimeSeconds(mv),
        ["genres"] = mv.Genres ?? Array.Empty<string>(),
        ["date_added"] = DateAdded(mv),
    };

    private static Dictionary<string, object?> ProjectAudioBook(AudioBook ab) => new()
    {
        ["type"] = "audiobook",
        ["id"] = ab.Id.ToString("N"),
        ["title"] = ab.Name,
        ["year"] = ab.ProductionYear,
        ["runtime_seconds"] = RuntimeSeconds(ab),
        ["genres"] = ab.Genres ?? Array.Empty<string>(),
        ["date_added"] = DateAdded(ab),
    };
}
