# jellywatch

A Jellyfin Server plugin that mirrors your entire media library to a static GitHub Pages catalog, so you can browse what you already own from anywhere without exposing your home server to the internet.

## What it does

- Plugin subscribes to Jellyfin library events (`ItemAdded` / `ItemUpdated` / `ItemRemoved`) for all media types
- Debounces a quiet window (~30s configurable) so a library scan pushes once, not once per item
- PUTs a `catalog.json` snapshot to a GitHub repo you own via the Contents API (authenticated with a narrow fine-grained PAT)
- A static viewer page hosted on GitHub Pages fetches that JSON and renders sections per media type
- Open the viewer URL on your phone while you're at a shop; check what you already own before buying

## Supported media types

Movies, TV Series, Episodes, Audio tracks, Music Albums, Music Artists, Books, Music Videos, Audiobooks.

Not included: Photos and PhotoAlbums (too many items in a typical library).

## Requirements

- Jellyfin Server 10.11.x
- A GitHub account
- A GitHub repository you own (public, free) that will hold the catalog JSON + viewer
- A fine-grained Personal Access Token scoped to ONLY that one repo with `Contents: read+write`

## Installing (manual sideload)

1. Grab the latest release zip from [Releases](../../releases).
2. Extract it into your Jellyfin server's plugin directory. On Unraid Docker, the standard host path is:
   ```
   /mnt/user/appdata/jellyfin/data/plugins/MediaCatalog/
   ```
   Note the `/data/` segment. Jellyfin looks for plugins under `<config>/data/plugins/`, NOT `<config>/plugins/`.
   Confirm your container's `/config` mount with:
   ```bash
   docker inspect jellyfin --format '{{ range .Mounts }}{{ .Destination }} <-- {{ .Source }}{{ "\n" }}{{ end }}'
   ```
3. The folder ends up with the `.dll` and `meta.json` directly inside (not nested). `chown -R nobody:users` so the container user can read them.
4. Restart the Jellyfin container.
5. Dashboard -> Plugins -> JellyWatch -> configure.

## Configuring

Open the plugin settings page in Jellyfin's admin dashboard. Fields:

| Field | Description |
|---|---|
| Owner | Your GitHub username |
| Repo | Target repo name |
| Branch | Default `main` |
| JsonPath | Default `docs/catalog.json` |
| PatToken | Fine-grained PAT (masked; "Show" toggle for verification) |
| DebounceSeconds | Default 30, min 5 |

Click **Test Connection** before **Save** to verify the PAT and repo path are correct.

PAT rotation: change the value here at any time. The next sync uses the new value immediately.

## Viewing the catalog

Open `https://<your-github-username>.github.io/<repo>/` in any browser. The viewer is plain HTML + JS, no login, no API key.

Note: anyone with the URL can see your media titles. Use a less-discoverable repo name if that is a concern.

## Building from source

Requires .NET 9 SDK.

```bash
dotnet build plugin/Jellyfin.Plugin.MediaCatalog.csproj -c Release
```

The built `.dll` lands at `plugin/bin/Release/net9.0/Jellyfin.Plugin.MediaCatalog.dll`. Drop it (plus `plugin/meta.json`) into your Jellyfin plugins folder.

## License

MIT. See [LICENSE](LICENSE).
