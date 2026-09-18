# Real Play Premium Profile Art

Premium profile art is an **admin-curated paid feature**. Players can see the finished artwork, but only an authorized Real Play admin can upload, replace, reposition, zoom, save, or remove it.

## Current authoritative workflow

The app now includes an admin-only **Profile Art Studio** directly on player profiles.

1. Open a player profile.
2. Admins see the camera button on the hero card.
3. Choose **UPLOAD ART** or **UPLOAD / REPLACE**.
4. Pick a transparent PNG or WebP from the device.
5. The **entire hero card is the editing canvas**.
6. Drag the portrait to move it. Pinch on touch devices or use `- / +` to zoom. Arrow controls provide precise nudging.
7. Press **SAVE**.
8. The backend stores the player's artwork source and the final X/Y/scale values, so every user sees the same composition.

The player is identified by the authoritative Real Play **Player ID**, not by jersey number.

## Backend authority

New uploads and saved framing are stored by the Real Play backend. The public profile renderer reads the same saved configuration for every viewer.

Stored presentation data includes:

- player ID
- artwork source
- X position
- Y position
- scale
- opacity / enabled state
- updated timestamp

Uploaded images are served from the Real Play API using unique immutable media paths. The frontend GitHub repository is no longer the normal place to add new premium portraits.

`registry.json` remains only as a **transition/fallback** for artwork that existed before the backend Profile Art Studio. When an admin saves or replaces that artwork, the backend becomes authoritative for that player.

## Official artwork standard

The editor can correct framing, but source artwork should still follow this standard for predictable quality:

- Canvas: **1600 x 2000 px**
- Aspect ratio: **4:5**
- Format: transparent **PNG** or **WebP**
- Framing: upper-body / mid-torso / waist-up
- Subject height: roughly **85–92%** of the canvas
- Subject width: roughly **70–85%** of the canvas
- Top transparent margin: roughly **5–8%**
- Side transparent margin: roughly **6–10%** where possible
- Bottom: torso may dissolve into smoke / particles / feathered transparency
- Keep face, jersey and body sharp
- Do not include a rectangular background, UI card, badges, stat boxes or floating labels in the source image
- Avoid large unused transparent areas

## Composition target

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

Do not generate a tiny full-body player floating inside a large transparent canvas.

## Recommended generation prompt block

> Create a transparent-background premium basketball profile portrait on a 1600x2000 (4:5) canvas. Frame the athlete from upper body to waist-up and make the visible subject occupy about 85–92% of the canvas height and 70–85% of the width, with minimal transparent padding. Keep the face and body sharp. Use soft feathered / smoky edge transitions around the shoulders, arms and lower torso so the portrait dissolves naturally into transparency. Do not create a background panel, UI, badges, stat boxes or floating text. The asset must be ready for placement on the full Real Play profile hero canvas.

## Legacy fallback

For profiles that still rely on the old static system, `registry.json` can reference an existing frontend asset. This is temporary compatibility only. Once that profile is saved or replaced through the Profile Art Studio, use the backend-managed version going forward.

Competitive data such as OVR, Rank, stats, records, badges, and eligibility are independent of premium profile art and are never controlled by this system.
