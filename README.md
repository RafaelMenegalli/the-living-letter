# The Living Letter

Turn a short personal message into a living, interactive scene, and send it to someone as a link.

A visitor writes up to 280 characters, picks one of four atmospheres (Calm, Celebration, Longing, Hope), tunes colour, lettering, glow and movement, and gets a link. Whoever opens the link receives a sealed letter; opening it brings up the same generative scene and reveals the words. The letter can also be saved as a PNG.

There is no backend, no database, no account and no API key. The site is a folder of static files.

The interface is available in English and Brazilian Portuguese.

## Stack, and why

| Choice | Reason |
| --- | --- |
| **Vite + React + TypeScript (strict)** | A static build with one HTML file. React carries the small amount of UI state; the visual engine is plain TypeScript and does not depend on React. |
| **Canvas 2D** for the scenes | Runs everywhere, degrades predictably, and the same code renders the live scene, the reduced-motion still and the exported PNG. No shader compilation, no context-loss handling, no GPU feature detection. |
| **No router, no state library** | Routing is three fragment patterns; the draft is one small store. |
| **Bundled fonts** (`@fontsource-variable`: Fraunces, Hanken Grotesk, Caveat — all SIL OFL) | No font service at runtime. Every stack ends in system fonts, so text is still set properly if a font file fails. |
| **Vitest, ESLint** | Unit tests for the logic that must not be wrong; `react-hooks` lint rules at their strict defaults. |

Runtime dependencies are `react`, `react-dom` and the three font packages. The production bundle is about 100 kB of JavaScript and 8 kB of CSS gzipped, plus font files that browsers fetch per script as needed.

## Getting started

Requires Node `^20.19` or `>=22.12`.

```bash
npm install
```

```bash
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload. |
| `npm test` | Runs the unit tests once (`npm run test:watch` to watch). |
| `npm run lint` | ESLint. |
| `npm run typecheck` | TypeScript, no emit. |
| `npm run build` | Type-checks, then writes the static site to `dist/`. |
| `npm run preview` | Serves `dist/` locally, exactly as a host would. |
| `npm run check` | Lint, tests and build in one go. |

## How it is organised

```
src/
  letter/        the letter model, text cleaning, the link codec, routes, the saved draft
  engine/        seeded randomness, palettes, the four scenes, the animation runner
  export/        text fitting and the PNG renderer; clipboard, download and share helpers
  i18n/          English and Portuguese dictionaries, language detection
  monetization/  the optional sponsor line (off by default)
  ui/            shared components: the scene canvas, letter typography, controls, dialog
  views/         landing, studio, the recipient experience, share and export dialogs
  styles/        plain CSS, one file per area
```

`engine/` and `letter/` have no React in them and are covered by tests that run under Node.

## How sharing works without a database

The whole letter travels inside the link, in the URL fragment:

```
https://your-site.example/#/l/1.ETwyM7AJYAA6TcOjZSwgb2JyaWdhZG8…
                              │ └─ base64url payload
                              └─── format version
```

Version 1 payload, big-endian:

| Bytes | Content |
| --- | --- |
| 1 | atmosphere (2 bits), palette (2 bits), lettering (2 bits), 2 reserved bits that must be zero |
| 1 | glow, 0–100 |
| 1 | movement, 0–100 |
| 4 | seed, unsigned 32-bit |
| 2 + n | message, UTF-8 |
| 1 + n | recipient name, UTF-8 |
| 1 + n | signature, UTF-8 |
| 2 | CRC-16 of everything above, seeded with the version |

A fifty-character message makes a link of roughly 120 characters.

Decoding (`src/letter/codec.ts`) trusts nothing. The version is checked first, so a link from a newer release is reported as such instead of as garbage. Every field is range-checked, every length is bounded, UTF-8 must be valid, no trailing bytes are accepted, and the checksum catches links that were cut off or altered in transit. Decoded text goes through the same cleaning as typed text (control characters and bidi overrides removed, NFC-normalised) and is only ever rendered as text nodes — never as HTML. A link that fails any check leads to a page that explains what probably happened and offers a way forward.

Because every random decision in a scene flows from the seed through a deterministic generator, the same link rebuilds the same composition: the same constellations, the same ribbons, the same order of fireworks. What is **not** promised is pixel-identical output: browsers rasterise differently, less capable devices draw fewer particles, and the animation is of course at a different moment each time.

Routing uses the fragment too (`#/`, `#/create`, `#/l/<token>`), so the host needs no rewrite rules, and the site works from a domain root or any sub-path.

## Privacy: what a link is and is not

- **The message is in the link.** Anyone who has the link can read the letter. It is not encrypted and it is not confidential.
- **A sent link cannot be edited or recalled.** There is no server copy to change or delete.
- **Nothing is stored for you.** If the link is lost, the letter is gone.
- URL fragments are not sent to the web server in HTTP requests, so the host's access logs do not contain letters. That is a property of how browsers work, not a security guarantee: links end up in chat histories, browser history and sync, link scanners and screenshots.
- A draft in progress is kept in the writer's own `localStorage` so a refresh does not lose it. It never leaves the device. If storage is unavailable the app simply does not remember the draft.

The share dialog says this in plain words before a link is copied. Please keep that notice if you adapt the project.

## Practical limits

**Link length.** A message is limited to 280 characters as a person would count them (an emoji is one) and to 1,000 bytes once encoded; names to 40 characters and 120 bytes. The worst case produces a link of about 1,700 characters, and the app refuses to create any link over 2,000. Most messengers handle that, but long links are the ones that get truncated or wrapped when pasted around — which is exactly what the checksum and the recovery page are for. Emoji-heavy messages reach the byte limit before the character limit; the editor explains this when it happens.

**Social previews are generic.** The letter lives in the fragment, which a server never sees, so a static site cannot produce a different preview image or title per letter. When a link is pasted into a chat, the preview is for *The Living Letter* in general. This project does not try to fake per-letter previews. The reliable way to show the letter itself is **Save image**: a PNG rendered on the device (4:5, 1:1 or 9:16) that can be posted or sent alongside the link.

## Deploying

```bash
npm run build
```

Upload the contents of `dist/` to any static host (Netlify, Vercel, Cloudflare Pages, GitHub Pages, S3, a plain web server). No server-side configuration is needed. Asset paths are relative, so `https://you.example/` and `https://you.example/letters/` both work unchanged.

### GitHub Pages, automatically

The repository includes a workflow, `.github/workflows/deploy.yml`, that publishes the site to GitHub Pages on every push to `main`. It installs dependencies, runs lint and tests, builds, and deploys; nothing is published if lint or tests fail.

It needs one setting, once: on GitHub, open **Settings → Pages** and, under **Build and deployment**, set **Source** to **GitHub Actions**. After that, push to `main` or start the workflow by hand from the **Actions** tab. The site is served at `https://<user>.github.io/<repository>/`.

The workflow hands the Pages address to the build as `VITE_SITE_URL`, so the metadata described below is filled in without further configuration, and stays correct if a custom domain is added.

### Site URL for metadata

Social scrapers need absolute URLs, and a static build cannot know where it will be hosted. Set `VITE_SITE_URL` at build time and the build adds a canonical link, `og:url`, and `og:image` / `twitter:image` pointing at the bundled `og.jpg`:

```bash
VITE_SITE_URL=https://letters.example.org npm run build
```

(or put it in a `.env` file — see `.env.example`). Without it those tags are left out rather than pointing at a made-up domain; the title and description are always present.

The files in `public/` (`og.jpg`, the PNG icons) were rendered with the app's own scene engine and fonts. `favicon.svg` is hand-written.

### Content-Security-Policy

Production builds include a strict CSP `<meta>` tag: same-origin scripts, styles, fonts and connections, plus `data:`/`blob:` images the app creates itself. It is defined in `vite.config.ts`. If you add third-party scripts later, that policy is what you will need to widen.

## Accessibility and motion

- The message is always real text in the DOM; the canvas is decorative and hidden from assistive technology. If canvas is unavailable, a still gradient in the same palette takes its place and everything else works.
- All controls are native form elements (radios, ranges, buttons, a `<dialog>`), keyboard-operable, labelled, with a visible focus ring.
- `prefers-reduced-motion` is honoured: scenes are painted as a single composed still and the word-by-word reveal is skipped. The pause/play button in the top bar overrides this in either direction, and the choice is remembered.
- The reveal on opening a letter lasts a few seconds at most and ends immediately on any key press, tap, or the "Show it all" button.
- Rendering pauses when the tab is hidden or the scene is scrolled out of view, and the canvas resolution steps down on devices that cannot keep up.
- There is no sound.

Palette contrast (message colour against every part of each sky, at least 7:1) is asserted in the test suite.

## Optional monetization

Off by default, and with nothing configured **nothing is rendered** — no empty boxes, no placeholders.

There are two placements, both away from the moments that matter (`src/monetization/`):

- `landing` — below the explanation on the landing page;
- `after-letter` — in the footer of a letter, only after it has been opened, never over or beside the message.

The built-in implementation is a single, clearly labelled text link set at build time:

```bash
VITE_SPONSOR_NAME="Example Stationery"
VITE_SPONSOR_URL="https://example.org"
VITE_SPONSOR_TEXT="Paper for people who still write."
```

All three must be set, and the URL must be `https`. To use an advertising network instead, render its unit inside `SponsorSlot` for the placements you want and extend the CSP accordingly. No provider has been chosen or integrated here. Doing so is the site owner's decision and responsibility: provider approval, consent and privacy obligations (cookies, GDPR/LGPD and similar), and content policies all need to be assessed separately. The studio and the message itself have no placements, by design.

## Known limitations

- **Tested in one engine.** Browser checks were done in a Chromium-based browser at desktop and emulated phone sizes. Safari, Firefox and real phones were not tested. The code avoids engine-specific features, and CSS that older browsers lack (container query units, `:has()`, `text-wrap`) is used only as enhancement, but that is not the same as having tested there.
- **Not exercised:** the native share sheet (`navigator.share` was not available in the test browser; the copy-link path was), real screen readers, on-screen keyboards, and behaviour on genuinely slow hardware (the resolution-stepping logic has not been observed under real load).
- **Scenes vary a little between devices**, as described above.
- **No per-letter social previews**, as described above.
- **No sound and no video export.** Image export is PNG only.
- `npm audit` reports no issues in runtime dependencies. At the time of writing it reports moderate advisories in development tooling (`minimatch`, pulled in by the linter), which is not shipped to visitors.
