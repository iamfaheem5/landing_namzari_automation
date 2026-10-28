# Design Specification — Mutation Automation

> **Purpose:** This document is the contract for anyone (human or AI agent) adding to this site.
> The site is a **Linear-inspired, dark-first, single-page marketing site** for an independent
> automation service for Bangladesh's mutation portal (`mutation.land.gov.bd` / নামজারি).
> If a new element is not covered here, extend the existing tokens and patterns — do **not**
> introduce a new palette, font, shadow style, or corner radius language.

- **Stack:** Astro 4 (hybrid output: static pages plus a Node API route), plain global CSS, no UI framework, no CSS-in-JS.
- **Source of truth:** `src/styles/global.css` (tokens + components), `src/pages/index.astro` (sections), `src/layouts/Base.astro` (head/fonts).
- **Brand name:** Mutation Automation
- **Contact (live):** WhatsApp `01400133142` → `https://wa.me/8801400133142`; email `contact@nazariautomation.xyz`

---

## 1. Design Principles

1. **Dark canvas, quiet surfaces.** Page base is `#08090A`; panels are `#0F1011`. Depth comes from
   color blocking and 1px translucent borders — not heavy shadows.
2. **White is precious.** Pure white is reserved for CTAs, key numbers, active states, and the logo
   mark. Body copy uses `--body`, not white.
3. **Pill interactives, sharp containers.** Buttons/badges/pills use `border-radius: 9999px`.
   Cards and structural blocks use 9px (occasionally 8px) — never larger than 12px.
4. **Negative tracking on display type.** Big headlines are compressed (`-1.58px` at 72px).
   Never reset letter-spacing to 0 on display sizes.
5. **Hierarchy through weight, not size alone.** Inter weights: 300 body, 400 neutral, 510/590 emphasis.
6. **Monospace = technical only.** Use `.code` for URLs, IDs, logs, numbers, step counters, eyebrows
   in the strip. Never for prose.
7. **Restraint in motion.** Allowed: `filter: brightness(120%)` hover, background hover on nav/footer
   links, smooth scroll. No keyframes, no scroll-jacking, no parallax.
8. **Specific beats generic.** Copy references concrete portal artifacts: abedon, khatian, dag,
   shunani, DCR, NID, Ekpay, 502s. Keep that specificity.

---

## 2. Color Tokens

Defined in `:root` in `src/styles/global.css`. **Use the CSS variable; never hard-code the hex**
outside the token block (one documented exception: the yellow CTA card and its text).

| Token | Hex / value | Role |
|---|---|---|
| `--primary` | `#FFFFFF` | CTAs, active dot, progress fill, selection bg, logo mark |
| `--canvas` | `#08090A` | Page background, footer background |
| `--surface` | `#0F1011` | Cards, terminal, bug table, CTA inner card |
| `--surface-raised` | `#222324` | Reserved (defined, currently unused) |
| `--ink` | `#F7F8F8` | Headings, strong labels, card titles |
| `--body` | `#D0D6E0` | Default body copy, secondary labels |
| `--muted` | `#8A8F98` | Card paragraph copy, nav links, captions, eyebrow text |
| `--faint` | `#62666D` | Strip text, hero meta, footer small print, step numbers, log dim |
| `--on-primary` | `#222222` | Text on light/filled buttons |
| `--hairline` | `#E5E5E6` | Filled button bg/border |
| `--border-soft` | `rgba(255,255,255,0.08)` | Reserved helper (most borders are written literal) |
| `--glass` | `rgba(255,255,255,0.04)` | Small glass buttons, icon container |
| `--glass-2` | `rgba(255,255,255,0.07)` | Badge background, warn pills |

**Literal borders/fills used in components** (match these rather than inventing new ones):

- Card / terminal / table border: `1px solid rgba(255,255,255,0.08)`
- Nav bottom border: `1px solid rgba(255,255,255,0.08)`
- Footer top border: `1px solid rgb(35,37,42)`
- Dashed dividers (terminal key/value rows): `1px dashed rgba(255,255,255,0.08)`
- Alternating table row: `rgba(255,255,255,0.02)`; header row: `rgba(255,255,255,0.04)`
- Button glass: `rgba(255,255,255,0.05)`; nav hover: `rgba(39,44,48,0.75)`

**Featured CTA exception:** background `#E4F222`, foreground `#1A1C00` (this is the only chromatic
accent on the site and is intentional as the single conversion moment). Its inner panel returns to
`var(--surface)`.

**Selection:** white bg, `#08090A` text.

**No semantic colors.** The site ships no error/warning/success hues. The pills `pill-ok` and
`pill-warn` are monochrome (white / glass), not green/amber. If a future feature truly requires
status color, add a documented semantic extension here first.

---

## 3. Typography

**Family:** Inter Variable (loaded from Google Fonts in `Base.astro` with `opsz,wght@14..32,300..700`).
Fallback stack: `Inter, system-ui, -apple-system, "Segoe UI", sans-serif`.
**Bengali:** Noto Sans Bengali 400/500/600, applied to `[lang="bn"]` for extracted NID text.
**Mono:** `Berkeley Mono, "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`
(JetBrains Mono is loaded as the practical fallback; apply via `.code`).

### Scale (classes available globally)

| Class | Size | Weight | Line-height | Tracking | Color |
|---|---|---|---|---|---|
| `.display-xl` | `clamp(38px, 7vw, 72px)` | 510 | 1 | `-1.58px` | `--ink` |
| `.display-md` | `clamp(32px, 4.5vw, 48px)` | 510 | 1 | `-1.06px` | `--ink` |
| `.heading-md` | 32px | 400 | 1.13 | `-0.7px` | `--ink` |
| `.heading-sm` | 20px | 590 | 1.33 | `-0.24px` | `--ink` |
| `.body-xl` | `clamp(17px, 2vw, 24px)` | 400 | 1.33 | `-0.29px` | `--body` |
| `.body-lg` | 15px | 300 | 1.6 | `-0.06px` | `--body` |
| `.body-md` | 13px | 400 | 1.54 | `-0.04px` | inherits |
| `.code` | inherits | 400 | inherits | 0 | inherits (mono) |

Additional in-component sizes: nav links 13px/1.5; buttons 13.33px and 15px (large); card h3 16px/590;
card p 13px/1.6 muted; badge 13px; badge text / captions 12px; pills 11px/510; terminal log 12px/1.7;
step numbers 12px mono; eyebrow 12px/510 uppercase with `.08em` tracking; stat number 32px/510 `-0.7px`.

### Rules

- Headings use `margin: 0`; spacing is controlled by the parent (`gap`, `margin-top`), not by default h2 margins.
- Body paragraphs inside `.section-head` get `margin: 14px 0 0`.
- Never use uppercase except the `.eyebrow` label and the text inside the stats strip (which is
  styled as `.code` uppercase content in the markup itself).
- Bangla text may be mixed into English copy (নামজারি, শুনানি, খতিয়ান). Keep it inline, same size;
  do not italicize it.

---

## 4. Spacing, Radius, Elevation, Z-index

**Spacing rhythm (4px base):** 4, 8, 12, 16, 20, 24, 28, 32, 36, 40.
In practice: card padding 20px; grid gap 16px; button paddings 14px (small) / 20px (large);
hero section padding `96px 0 40px`; normal section `72px 0`; strip `20px 0`; footer `40px 0`.
Section heads: `max-width: 720px; margin-bottom: 32px`.

**Radius:**
- `9999px` — all buttons, pills, icon circles, brand mark, progress bar, term dots, term URL.
- `9px` — cards, terminal, bug table.
- `8px` — small glass button (`.btn-sm-glass`), featured CTA card.
- `3px` — badges.
- `4px` — reserved for links (design source).
- Nothing above 12px; never round a full-width section.

**Elevation:** flat surfaces + 1px border. Only these shadows are allowed:
- Card / terminal / bug table: `rgba(0,0,0,0.2) 0 0 0 1px`
- Glass large button: inset white highlights + `rgba(0,0,0,0.6) 0 0 0 1px` + `rgba(0,0,0,0.1) 0 4px 4px`
- Badge dot glow: `0 0 12px rgba(255,255,255,.9)`
- Hero / shot glows are radial gradients, not box-shadows.

**Z-index:** nav `100`; everything else defaults. Dropdown `50`, modal `5000` are reserved and unused.
Do not add new z-index values unless a new overlay is introduced.

---

## 5. Layout

- **Container:** `.container` → `max-width: 1344px; margin: 0 auto; padding: 0 24px;` (16px under 768px).
- **Hero copy width:** `880px` centered; hero sub-copy `640px`; product shot `960px`.
- **Grids:** `.grid-3` (3 × `1fr`, 16px gap) → 1 column ≤900px. `.grid-2` exists (2 × `1fr`) → 1 column ≤900px.
- **Stats:** 4 columns → 2 columns ≤900px.
- **Bug table:** 2-column rows → stacked ≤720px (divider flips from vertical to horizontal).
- **Terminal:** 2-column split (`1.05fr .95fr`) → stacked ≤820px.
- **Steps:** 3 columns → 1 column ≤900px (uses `.card.step` + `.step-num` 01/02/03).
- **Nav:** sticky, 72px, blurred `rgba(8,9,10,0.72)`; links hidden ≤900px (no hamburger — CTAs remain).
- **Section spacing:** consecutive sections often set inline `style="padding-top:0"` to avoid doubling —
  follow that pattern when stacking sections.
- **Products/section order:** Nav → Hero (+ live-run terminal) → stats strip → Experience/Stats →
  Product features (6 cards) → Bug map (table) → How it works (3 steps) → Audiences (3 cards) → CTA → Footer.
  Keep this narrative order for the landing page.

---

## 6. Components

### Buttons (all `.btn` + modifier)

| Class | Use | Height | Padding | Look |
|---|---|---|---|---|
| `.btn.btn-filled` | primary nav CTA | 32px | 0 14px | hairline bg, dark text, pill |
| `.btn.btn-filled.btn-lg` | hero primary CTA | 44px | 0 20px | 15px text |
| `.btn.btn-glass` | secondary CTA | 44px | 0 20px | glass bg, ink text, layered inset/outer shadow |
| `.btn.btn-sm-glass` | small nav secondary | 28px | 0 12px | `rgba(255,255,255,.04)`, **8px** radius |
| `.btn.btn-dark` | CTA on yellow card | 44px | 0 20px | `#111` bg, white text |

Hover on all: `filter: brightness(120%)`. Focus: this site does not currently define a custom
focus ring — if you add one, use a 2px white ring (`0 0 0 2px var(--canvas), 0 0 0 4px #fff`) and
document it here. Do not use filter hover on text links.

### Badge (`.badge`)

Glass chip, `3px` radius, 26px tall, 13px text, with `.dot` (7px white glowing circle) and
`.badge-text` (12px/510 muted). Used once in the hero: "Built for mutation.land.gov.bd · v3 live".
Do not scatter badges through sections.

### Cards (`.card`)

`--surface` bg, `1px solid rgba(255,255,255,0.08)`, radius 9px, padding 20px, shadow ring.
Inside: optional `.icon` (32px circle, glass, 1px border, symbol glyph), `h3` 16px/590 ink with
`margin: 12px 0 8px`, `p` 13px/1.6 muted.
Cards are **not** links currently; if made clickable, hover should be a border brightening
(`rgba(255,255,255,0.16)`), not transform/scale.

Tool cards (`.tool-card`) use a 240px minimum height, 20px/590 `h2` title, and a bottom-aligned
monochrome "Coming soon" pill until the individual tool is available. Available tools use the filled
"Open tool" button. The NID photo extractor uses a dashed upload dropzone, compact export-spec panel,
2-column result cards, and local OpenCV/YuNet processing; exports are 300×300 JPEGs under 300 KB.
The NID text extractor uses the same upload shell with a preview, an extract action, a privacy note,
and a full-width results card. Its `dl` grid holds seven fields — name in Bengali and English,
parents’ names, address, date of birth, and NID number; Bengali values use Noto Sans Bengali.
The server sends the image to Gemini for verbatim OCR, then sends that transcript to ScaleDown Extract.

### Section head

```html
<div class="section-head">
  <div class="eyebrow">Product</div>
  <h2 class="display-md">Headline</h2>
  <p class="body-lg">Supporting copy.</p>
</div>
```

Eyebrow = short 1–3 word label, uppercase, muted. Headline = outcome, sentence case, ends with a period.
Supporting copy ≤ 2 sentences.

### Live-run terminal (hero product shot)

The signature visual. Do not replace it with screenshots or stock imagery.
Structure: `.shot-wrap` → `.shot-glow` + `.terminal` (`.term-bar` with 3 dots + `.term-url` pill +
`.pill-ok` "live run"; `.term-body` with `.term-left` key/value rows and `.term-right` monospace log).
Left uses Bangla labels for portal fields and `.pill-ok`/`.pill-warn` monochrome pills; right uses
`.log` with `.ok` (white) and `.dim` (faint). Progress bar is white on a 6px glass track.
If updating fictitious case data, keep the same format: `MUT-YYYY-#####`, `K-####`, `Dag ####`,
`৳` amounts, hearing dates.

### Stats strip

Full-bleed band, top/bottom `rgba(255,255,255,.07)` borders, 20px vertical padding, centered flex row,
`.code` 13px faint, items separated by literal `·`. Content is uppercase claims:
`5+ YEARS ON LAND.GOV.BD · 12,000+ MUTATIONS FILED · 40+ BUGS MAPPED · 99.2% FILING SUCCESS · নামজারি · খারিজ · e‑পর্চা`.
Keep the numbers consistent with the stats cards.

### Bug table (`.bugs`)

A 2-column "Portal bug / Our workaround" table built from divs, not `<table>`.
`.bug-row.head` for the header; each row: left cell muted with a `<b style="color:var(--body)">`
title + `<br />` + detail; right cell `--body` workaround copy. Alternating rows tinted 2% white.
≥720px: vertical divider between columns; <720px: cells stack with a bottom divider.
Add new bugs in the same shape (title → symptom detail → coded workaround). Keep the "+ 34 more in the
private runbook" footnote after the table.

### Steps

Three `.card.step` items with `.step-num` mono labels `01`, `02`, `03`. Headline pattern:
"Send deeds. Get hearing dates." Copy stays 1–2 sentences, concrete artifacts only.

### Featured CTA (`.featured`)

Yellow `#E4F222` panel, radius 8px, padding 32px, 2-column (`1.2fr .8fr`) → stacked ≤900px.
Left: h2 32px/510 `-0.7px` + 15px paragraph. Right: a **dark `.card`** (`background:#0F1011`)
containing `.code` "GET STARTED", WhatsApp number as h3, email + response-time line, and two buttons
(`.btn-dark` WhatsApp, `.btn-glass` email).
Below the panel: centered disclaimer "Independent automation service. Not affiliated with the
Government of Bangladesh or land.gov.bd." — **required on every page that markets the service.**

### Nav & footer

Nav: brand mark (28px white circle, black "M", 700 weight) + name 15px/590; links 13px muted with
pill hover; right side small glass + filled CTA. Links point to section anchors (`#product`, `#bugs`,
`#how`, `#experience`, `#contact`) and the `/tools` page. On secondary pages, anchor links use the
`/#section` form and the current page has `aria-current="page"`.
Footer: top border `rgb(35,37,42)`, brand block + one-line positioning + location, pill link row,
then 12px faint copyright. Keep footer links to section anchors and `/tools`.

---

## 7. Content & Voice

- **Tone:** confident, specific, operator-to-operator. Short declaratives. No exclamation marks.
- **Positioning:** "5 years on mutation.land.gov.bd. Every bug known. Every workaround coded."
- **Proof numbers (keep consistent everywhere):** 5 years, 12k+ mutations filed, 40+ bugs mapped,
  99.2% filing success, +34 more bugs in private runbook.
- **Vocabulary:** namjari / নামজারি, abedon / আবেদন, khatian / খতিয়ান, dag / দাগ, shunani / শুনানি,
  e‑porcha / e‑পর্চা, DCR, AC Land, NID, Ekpay. Use transliteration first, Bangla inline where it
  adds authenticity (hero terminal, strip).
- **Claims discipline:** never invent customer names, logos, testimonials, or government affiliation.
  The disclaimer must remain.
- **Headline style:** sentence case, ends with a period, no more than ~8 words on display sizes.
  Examples shipped: "Mutation filing, automated end-to-end." / "We don't guess. We've filed through every outage."
- **Bilingual:** do not translate the whole site; Bangla appears as portal-native terms and field labels only.

---

## 8. Responsive Behavior

| Breakpoint | Behavior |
|---|---|
| ≤ 900px | Nav links hidden; `.grid-3`/`.grid-2`/`.steps`/`.featured` collapse to 1 column; stats become 2 columns |
| ≤ 820px | Terminal body stacks to 1 column |
| ≤ 768px | Container padding 24px → 16px |
| ≤ 720px | Bug table rows stack; column divider becomes row divider |

Headings scale fluidly via `clamp()` on `.display-xl`/`.display-md`/`.body-xl`; do **not** add
separate mobile font-size overrides unless a new component needs it. Touch targets: buttons ≥32px,
primary CTAs 44px; nav/footer links have 12px horizontal padding.

---

## 9. Accessibility & Quality Bar

- Maintain the ink hierarchy: `--ink` on `--surface`/`--canvas` for headings; `--body` for paragraphs;
  `--muted` only for secondary text (≥13px); `--faint` only for decorative/meta text (≤12px) and
  never as the sole carrier of meaning.
- Decorative divs (`.hero-grid-bg`, `.shot-glow`, `.progress`) must stay `pointer-events: none` and
  out of the accessibility tree (add `aria-hidden="true"` when editing).
- Links must have discernible text; icon-only controls need `aria-label`.
- Do not disable focus outlines globally.
- Keep heading order: one `h1` (hero), `h2` per section, `h3` inside cards.
- New pages must reuse `Base.astro` (title + description props, favicon, font preconnects).

---

## 10. File Map & Change Checklist

```
src/
  layouts/Base.astro      # <head>, fonts, global.css import, slot
  pages/index.astro       # landing page sections in narrative order
  pages/tools.astro       # document tools directory
  pages/tools/photo-extraction.astro # private NID portrait extractor
  pages/tools/nid-extraction.astro   # NID field extraction interface
  pages/api/nid-extract.ts           # server-only OCR + ScaleDown endpoint
  styles/global.css       # tokens + all component classes
public/favicon.svg        # white circle "M" mark
astro.config.mjs          # hybrid output with Node adapter
```

Before committing a change:

1. Reuse existing classes/tokens; no new colors, fonts, radii, or shadows without updating this doc.
2. Verify both desktop and ≤900px layout (nav hides, grids stack).
3. Keep contact details exactly: WhatsApp `01400133142` / `https://wa.me/8801400133142`,
   email `contact@nazariautomation.xyz`.
4. Keep the "not affiliated" disclaimer on marketing pages.
5. Run `npm run build` — must complete with the static routes `/`, `/tools`, `/tools/photo-extraction`, and `/tools/nid-extraction`.
6. If you add a component or token, document it in this file in the same table/section format.

---

## 11. Do / Don't Quick Reference

**Do**
- Use `var(--canvas)` page / `var(--surface)` panels; separate with 1px `rgba(255,255,255,.08)`.
- Keep display tracking negative; keep buttons and badges pill-shaped.
- Use monospace for IDs, logs, step numbers, and the stats strip.
- Write concrete, portal-specific copy and keep proof numbers consistent.
- Let negative space do the work; sections breathe at 72px rhythm.

**Don't**
- Don't introduce purple/blue "SaaS" gradients, glows in color, or semantic green/red status chips.
- Don't use white as body text or add opacity stacking on already-translucent surfaces.
- Don't round cards above 12px or square off buttons.
- Don't add heavy shadows, 2px+ borders, or multiple elevation layers.
- Don't replace the terminal mock with stock photography or add a testimonial/logo wall we can't substantiate.
- Don't remove the independence disclaimer or change contact details without explicit approval.
