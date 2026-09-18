# Real Play Premium Profile Art

This folder is intentionally **manual/admin-curated**.

Players do not receive an upload button or self-service editor for this feature. A premium portrait is shown only when a Real Play operator adds an approved artwork file here and assigns it in `registry.json`.

## Official artwork standard

Use this spec for every new premium player portrait so the app can size it consistently without guessing per-player zoom values.

- Canvas: **1600 x 2000 px**
- Aspect ratio: **4:5**
- Format: transparent **PNG** or **WebP**
- Framing: upper-body / mid-torso / waist-up
- Subject height: roughly **85–92%** of the canvas
- Subject width: roughly **70–85%** of the canvas
- Top transparent margin: roughly **5–8%**
- Side transparent margin: roughly **6–10%** where possible
- Bottom: torso may dissolve into smoke / particles / feathered transparency
- Keep the face, jersey and body sharp
- Do not include a rectangular background, UI card, badges or stat boxes in the image
- Avoid large empty transparent areas around the player

The app's standard renderer intentionally sizes the portrait by width and allows the tall 4:5 source to crop naturally inside the hero card. This is what makes the athlete dominate the right side instead of looking like a small thumbnail.

## Composition target

The generated image should already feel large before it reaches the app:

```text
1600 x 2000 transparent canvas

+------------------------------+
|       small top margin       |
|          HEAD / FACE         |
|      SHOULDERS / CHEST       |
|      JERSEY / BALL / ARM     |
|     TORSO / EDGE EFFECTS     |
|  FEATHER / SMOKE / DISSOLVE  |
+------------------------------+
```

Do **not** generate a tiny full-body player floating inside a large transparent canvas.

## Recommended generation prompt block

Reuse this requirement for future player generations:

> Create a transparent-background premium basketball profile portrait on a 1600x2000 (4:5) canvas. Frame the athlete from upper body to waist-up and make the visible subject occupy about 85–92% of the canvas height and 70–85% of the width, with minimal transparent padding. Keep the face and body sharp. Use soft feathered / smoky edge transitions around the shoulders, arms and lower torso so the portrait dissolves naturally into transparency. Do not create a background panel, UI, badges, stat boxes or floating text. The asset must be ready to dominate the right side of the Real Play profile hero card.

## Suggested filename

`player-<playerId>-<slug>.png`

Example:

`player-184-max-emorej.png`

## Assigning artwork

For standard artwork, the registry should normally stay simple:

```json
{
  "playerId": 184,
  "src": "assets/profile-art/player-184-max-emorej.png",
  "fitMode": "standard",
  "opacity": 1
}
```

`playerId` is the preferred authoritative key and is **not the jersey number**. During early testing, the renderer also supports an exact `playerName` plus optional `jerseyNumber`, but player ID should be used once known.

## Fit modes

### `standard`

Use for artwork generated to the official 1600x2000 spec. This should be the default for all new premium portraits. The app assumes the player already fills the canvas and renders the asset as dominant hero art.

### `manual`

Use only for older or unusual artwork that does not follow the standard. Manual mode supports these optional tuning fields:

- `positionX`
- `positionY`
- `scale`
- `opacity`

Example:

```json
{
  "playerId": 184,
  "src": "assets/profile-art/legacy-player.png",
  "fitMode": "manual",
  "positionX": "58%",
  "positionY": "40%",
  "scale": 1.35,
  "opacity": 1
}
```

The renderer checks the loaded image aspect ratio and warns in the browser console when a `standard` asset is not close to 4:5.

No entry in the registry means no premium portrait is rendered. Competitive data such as OVR, Rank, stats and record are never read from this registry.
