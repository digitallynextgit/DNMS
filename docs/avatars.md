# Preset avatars

Employees who would rather not upload a photo can pick a preset instead
(Profile → Edit Profile Photo → Choose an avatar).

- Files: `public/avatars/<id>.<ext>`
- Ids: `av-<role>-<nn>`, e.g. `av-design-03`
- Roles and counts: [`lib/avatars.ts`](../lib/avatars.ts)

The current set is **42 anime-style character portraits**, six per role, drawn in
a consistent 2000s cel-shaded style.

A chosen preset is stored in `Employee.profilePhoto` as its public path
(`/avatars/av-design-03.webp`) with `profilePhotoKey` left null. Every avatar in
the app already renders a URL, so presets need no special-casing anywhere. The
null key is what distinguishes a preset from an uploaded photo held in B2.

## Regenerating the set

Generated with Higgsfield via MCP. The pipeline is two scripts plus a manifest:

1. Generate one image per id with `generate_image`. Model **`z_image`**: it holds
   the cel-shaded look, renders full-bleed, and unlike `soul_2` it does not
   decorate output with signatures or picture frames. ~0.15 credits each.
2. Collect `{ "av-web-01": "https://...", ... }` into a manifest JSON.
3. `npx tsx scripts/fetch-avatars.ts <manifest.json>` downloads, resizes to
   512px, converts to WebP and clears any previous files.
4. If any image has an edge artifact, `npx tsx scripts/recrop-avatars.ts
<manifest.json> <ids...> --factor 0.68` re-crops it tighter from the
   ORIGINAL, so quality loss is not compounded.

### Prompt formula

Keep the style block identical across every image so the set reads as one
family, and vary only the subject:

> Anime character portrait in classic 2000s shonen anime style, cel-shaded
> hand-drawn animation still, bold black ink outlines, flat cel shading with hard
> shadow edges, large expressive eyes with sharp highlights, head and shoulders
> centred and filling the square frame edge to edge, plain flat {BACKGROUND}
> background, vibrant saturated anime colour palette, key visual quality.
> {SUBJECT}. Original character. Absolutely no text, no logos, no watermark, no
> signature, no lettering, no border, no frame, no speech bubbles.

| Role      | Background  | Subject cues                                     |
| --------- | ----------- | ------------------------------------------------ |
| `web`     | lavender    | hoodie or plain tee, headphones around neck      |
| `design`  | soft pink   | creative clothing, beret, expressive hair colour |
| `content` | mint green  | knit or shirt, glasses, thoughtful               |
| `video`   | peach       | utility jacket or dark tee, camera strap, cap    |
| `social`  | sky blue    | bright top, upbeat energetic expression          |
| `hr`      | powder blue | blouse or shirt, plain lanyard                   |
| `lead`    | warm sand   | high-collar coat or blazer, composed             |

Vary apparent age, gender presentation, skin tone and hair colour across the six
in a role, so a team of six does not look like one character six times.

### Two things that bite

- **Word choice leaks into the image.** Prompting "social media manager"
  made the model render Instagram UI chrome over the portrait. Describe the
  person, not their job title, and add the role cue as clothing instead.
- **Named characters are off limits.** Generating recognisable likenesses of
  copyrighted characters (Naruto, One Piece, Death Note and so on) and shipping
  them in a product is an IP exposure. The _style_ is fine; specific characters
  are not. Every prompt says "Original character" for this reason.

## Changing the format

Nothing in the app assumes WebP beyond `AVATAR_EXT` in `lib/avatars.ts`. Drop
files with the same ids in another format, change that constant, and everyone
who already picked a preset keeps their id and gets the new artwork.

To change how many exist per role, update `AVATARS_PER_ROLE` in the same file
and name the files to match.

## Before shipping a new set

- **Small sizes.** Avatars render at 16-24px in task cards and lists. Build a
  contact sheet and look at it small; anything relying on fine detail turns to
  mud.
- **Weight.** 512px WebP at quality 82 lands around 15-30 KB. A directory page
  paints dozens at once, so keep well under 100 KB each.
- **Artifacts.** Check every tile for hallucinated text, watermarks, borders or
  UI chrome before shipping. Re-crop or regenerate the offenders.
