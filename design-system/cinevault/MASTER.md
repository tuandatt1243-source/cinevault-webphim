# CineVault — Editorial Cinema Design System (Master Source of Truth)

> Crafted for **CineVault** (Website quản lý phim tích hợp gợi ý phim cá nhân hóa).  
> Inspired by **MUBI**, **The Criterion Channel**, **Letterboxd**, and **A24** archival editorial aesthetics.  
> Strictly **NO generic AI SaaS clichés** (no purple/indigo-cyan gradients, no glowing glass blobs, no emoji icons).

## 1. Visual Direction & Color Tokens

| Semantic Token | Hex / Value | Usage |
|---|---|---|
| `--bg-canvas` | `#0B0B0D` | Warm obsidian screening-room canvas |
| `--bg-surface` | `#131317` | Primary panels, sidebar, data tables, modals |
| `--bg-elevated` | `#1B1B21` | Hover rows, active cards, form inputs |
| `--border-hairline` | `rgba(243, 239, 230, 0.09)` | Swiss editorial 1px structural rules |
| `--border-strong` | `rgba(243, 239, 230, 0.22)` | Focused borders, active dividers |
| `--text-primary` | `#F3EFE6` | Archival warm bone text (15.8:1 contrast on canvas) |
| `--text-secondary` | `#A59F95` | Warm stone metadata & subtitles (7.1:1 contrast) |
| `--text-muted` | `#746F67` | Subtle labels & table captions |
| `--accent-crimson` | `#D63628` | Primary editorial CTA, active nav bar, live indicator |
| `--accent-crimson-hover` | `#E54739` | Primary CTA hover |
| `--accent-gold` | `#E0A43B` | Ratings, stars, Criterion archival highlights |
| `--status-ok` | `#3DA86E` | Published / Active status (always paired with icon + text) |
| `--status-warn` | `#D99B26` | Hidden / Pending moderation |
| `--status-danger` | `#E04848` | Locked / Soft-deleted / Destructive action |

## 2. Typography Tri-Stack (Vietnamese Optical Diacritics Verified)

- **Display / Editorial Titles**: `Newsreader` (Variable `opsz: 6..72`, `400..700` + Italic) — MUBI / Criterion editorial optical serif with clean, well-proportioned Vietnamese stacked diacritics (`ế, ồ, ữ, ệ, ẳ`) at both 16px cards and 56px hero spreads (`font-optical-sizing: auto`).
- **UI & Body**: `Be Vietnam Pro` (300, 400, 500, 600, 700) — Crafted by Vietnamese type designers for ultra-legible tables, forms, buttons, and reviews.
- **Archival Metadata / Ledger Numbers**: `IBM Plex Mono` (400, 500, 600) with `font-variant-numeric: tabular-nums` — warm archival film-slate aesthetic for years, runtimes, ratings, MongoDB IDs, and index metrics.

### Vietnamese Typography Discipline
- Avoid `leading-none` / `< 1.18` on Vietnamese headings to prevent top-diacritic clipping; use `1.2–1.32` for display headings and `1.65` for prose.
- Keep uppercase Vietnamese micro-labels at `>= 11px`, weight `500`, and `tracking-[0.12em–0.16em]`.
- Enable `text-rendering: optimizeLegibility` and `font-optical-sizing: auto`.

## 3. UI/UX Pro Max Quality Gate (Mandatory Rules)

- **Zero Emoji Icons**: Use crisp `lucide-react` 1.5px stroke SVGs exclusively; `aria-hidden="true"` on decorative icons, `aria-label` on icon-only buttons.
- **Accessibility**: Minimum 4.5:1 text contrast, visible keyboard focus rings (`focus-visible:ring-2 focus-visible:ring-[#F3EFE6]`), ESC closes drawers/modals, `prefers-reduced-motion` respected.
- **Cinema Media Discipline**: All movie posters lock `aspect-[2/3]` with `loading="lazy"` and graceful typographic fallback poster if an external image fails to load (zero layout shift / CLS < 0.1).
- **Forms & Destructive Safety**: Visible labels (never placeholder-only), inline field validation on blur/submit, confirmation dialogs before soft-delete/hard-delete, Undo/Restore action for soft-deleted movies, non-blocking `aria-live="polite"` toast feedback.
- **Data Visualization**: Charts paired with tabular figures & text labels (never color-only meaning).
- **Responsive**: Clean at 375px, 768px, 1024px, 1440px with `overflow-x-auto` tables and collapsible mobile sidebar drawer.
