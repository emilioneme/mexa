# MEXAM logos

Nine logo directions, exported from the MEXAM logo design canvas. Each folder holds the same five SVGs. The wordmarks are converted to outlines, so they don't depend on any font:

| File | Use |
| --- | --- |
| `mark.svg` | Symbol only, on light backgrounds |
| `mark-dark.svg` | Symbol only, on dark backgrounds |
| `lockup.svg` | Symbol + wordmark, on light backgrounds |
| `lockup-dark.svg` | Symbol + wordmark, on dark backgrounds |
| `icon.svg` | App icon / favicon (rounded square tile) |

| Folder | Direction |
| --- | --- |
| `pass-mark` | A · Pass mark |
| `crossing` | B · Crossing |
| `progress-ring` | C · Progress ring |
| `signature-ring` | D · Ring, refined (current default) |
| `crossing-green` | E · Crossing in green |
| `ring-crossing` | F · Ring + Crossing |
| `box-m` | G · Box M |
| `shopping-bag` | H · Shopping bag |
| `refresh` | I · Refresh |

## Choosing the logo on the site

The "Logos" button in the bottom-right corner of the site switches between all nine. It works like the theme switcher in `vanilla-brand`: the choice is saved in the browser, and a link with `?logo=<folder>` (for example `?logo=refresh`) opens the site with that logo.

To set the logo everyone sees by default, change `MEXAM_DEFAULT_LOGO` in `js/data/logos.data.js`. When you've settled on one, update the `src` in `components/header.html` and `components/footer.html` to match, then remove the switcher's script and CSS tags from `index.html`.
