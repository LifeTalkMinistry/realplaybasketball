# Real Play Premium Profile Art

This folder is intentionally **manual/admin-curated**.

Players do not receive an upload button or self-service editor for this feature. A premium portrait is shown only when a Real Play operator adds an approved artwork file here and assigns it in `registry.json`.

## Recommended artwork

- PNG or WebP
- Transparent background preferred
- Upper-body / waist-up basketball portrait
- Around 1000–1600 px tall is usually enough
- Keep the face and body sharp; the app supplies the edge fade into the profile card

Suggested filename:

`player-<playerId>-<slug>.webp`

Example:

`player-184-max-emorej.webp`

## Assigning artwork

Add a record to `registry.json`:

```json
{
  "playerId": 184,
  "src": "assets/profile-art/player-184-max-emorej.webp",
  "positionX": "72%",
  "positionY": "44%",
  "scale": 1.06,
  "opacity": 1
}
```

`playerId` is the preferred authoritative key and is **not the jersey number**. During early testing, the renderer also supports an exact `playerName` plus optional `jerseyNumber`, but player ID should be used once known.

Optional tuning fields:

- `positionX`: horizontal focal point, e.g. `72%`
- `positionY`: vertical focal point, e.g. `44%`
- `scale`: portrait scale multiplier
- `opacity`: artwork opacity from `0` to `1`

No entry in the registry means no premium portrait is rendered. Competitive data such as OVR, Rank, stats, and record are never read from this registry.
