# ID card asset

Drop one file here for the ID generator (`/dashboard/personnel/ids`) to render:

| Filename            | Where it shows up                |
|---------------------|----------------------------------|
| `id-template.png`   | The entire card design           |

The whole design (logos, swoosh, rotated committee text, "INSERT NAME"
and "COMMITTEE" placeholders) comes from this image. The app overlays:

- The personnel's **name** on top of the "INSERT NAME" area
- A short **role/designation** label on top of the "COMMITTEE" area
- The **QR code** on the back-side card, on top of the white photo box

Keep the file:

- **Aspect ratio**: portrait, around 1305 × 1850 px (the design you provided).
  If your image differs, tweak `--card-aspect` in `id-card.tsx`.
- **Format**: PNG (transparent background OK; the white outer border is
  drawn by the component).
- **Size**: at least 1300 px on the long side prints cleanly.

Until the file is in place, cards render as a blank gray placeholder with a
"Drop id-template.png in /public/id-assets" hint.
