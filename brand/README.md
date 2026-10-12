# Brand assets

`source/` holds the official files exactly as supplied. Do not edit them.

- `primary-logo.webp`: the primary lockup (monogram + DiscGolfBagTips) on a
  transparent background.
- `logo-kit.webp`: the full logo kit sheet. It's the reference for usage rules
  (clear space, minimum size, one-colour versions) and the source of the app icon.

The app uses crops and resizes of these, never redrawn artwork. They're
produced by `derive-assets.py`, which records the exact crop boxes:

| Output | From | Used for |
| --- | --- | --- |
| `src/assets/brand/logo-primary.webp` | primary logo, trimmed | high-density screens |
| `src/assets/brand/logo-primary-840.webp` | same, resized | header |
| `src/assets/brand/logo-mark.webp` | primary logo, monogram only | sign-in dialog |
| `public/favicon.png`, `public/apple-touch-icon.png` | kit section 04, app icon | browser tab, home screen |

The app icon in the kit sheet is 161 px, so it's crisp as a favicon but slightly
soft as a 180 px home-screen icon. A dedicated 512 px export of the icon would
fix that.

Kit rules applied in the UI: clear space around the logo equal to the height of
the monogram's "D", and a 120 px minimum on screen. On dark backgrounds the UI
shows the kit's single-colour white version.
