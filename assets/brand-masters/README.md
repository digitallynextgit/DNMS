# Brand masters

Full-resolution source images. **Not in `public/`, and that is the point** - every
file under `public/` is served at the root, so a 729 KB master sitting there is a
729 KB file the internet can fetch, on a site whose own pages never link it.

| File                | Size        | Derivatives it produces                                                                                                     |
| ------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------- |
| `brand-mark.png`    | 2505 × 2200 | `public/favicon.ico`, `public/brand-mark-104.png`, `public/brand-mark-72.png`, `public/icon-192.png`, `public/icon-512.png` |
| `logo_white_bg.png` | 4500 × 1167 | `public/logo_white_bg-96.png`                                                                                               |

Nothing imports these at build or run time. They are here so the derivatives can
be regenerated when the brand changes, which is why they are kept rather than
deleted.

## Regenerating

The web icons used by `app/manifest.ts`:

```bash
node -e "
const s=require('sharp');
(async()=>{
  const src='assets/brand-masters/brand-mark.png';
  for (const n of [192,512]) {
    await s(src).resize(n,n,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}})
      .png({compressionLevel:9}).toFile('public/icon-'+n+'.png');
  }
})()"
```

`scripts/build-favicon.ts` used to build `public/favicon.ico` from
`brand-mark.png` (deliberately the wide master, not the square
`brand-mark-72.png`). That script was deleted in `f15fc9f` along with the rest of
`scripts/`; recover it with `git show f15fc9f^:scripts/build-favicon.ts` if the
favicon ever needs rebuilding.
