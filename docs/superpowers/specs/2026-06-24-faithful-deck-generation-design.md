# Faithful Deck Generation (Strategy B) — Design

**Date:** 2026-06-24
**Status:** Approved by user, pending implementation plan

## Background

The first version of these skills (Node.js) generates a deck by *reconstructing* slides
from extracted data: it reads a template's theme colors, fonts, and placeholder positions
into `theme.json`, then rebuilds slides from scratch with `pptxgenjs`. This reproduces
brand colors, fonts, and text positions — but it drops everything that makes a corporate
deck look corporate: logos, brand bars, background graphics, section-divider art, icons,
and rich text styling. The output is an on-brand wireframe, not a finished deck.

The reason is structural: `pptxgenjs` can only *build new* slides; it cannot reuse a real
template's designed layouts. Any reconstruction approach has the same ceiling.

## Goal

Generate decks that **are** the corporate design — logos, brand bars, backgrounds, and
section graphics intact — by opening the user's real template and adding slides built from
its **own** slide layouts, then filling in Claude-drafted text. The master/layout graphics
ride along automatically because we reuse the real layouts rather than approximating them.

## Approach (decided)

- **Populate the template's real layouts** (not reconstruct, not clone individual exemplar
  slides). Open a copy of the real `.pptx`/`.potx` and `add_slide(layout)` using its own
  layouts, then fill the layout's placeholders.
- **Runtime: Python + `python-pptx`** — the mature library purpose-built for this. The
  Node implementation and its dependencies (`pptxgenjs`, `jszip`, `fast-xml-parser`) are
  retired. Both skills become Python.
- **Replace** the current generator entirely (no Node/Python coexistence).

## Non-goals

- No reconstruction of slides from extracted geometry (that was v1's ceiling).
- No cloning of individual hand-designed exemplar slides (possible future enhancement;
  out of scope here).
- No AI image generation. The template's native picture placeholders are left in place
  (PowerPoint shows its own "click to add picture" prompt).
- No web UI, no local LLM. Claude writes the content directly.

## Architecture

Same repository. Two Python skills replace the two Node skills:

```
deck-theme-setup/
  SKILL.md
  scripts/extract_layouts.py     # setup + learn (python-pptx)
  requirements.txt               # python-pptx
deck-builder/
  SKILL.md
  scripts/build_deck.py          # faithful generator (python-pptx)
  requirements.txt               # python-pptx
  templates/                     # local, gitignored: copied template files
  decks/                         # local, gitignored: generated output
deck-config.json                 # replaces theme.json (created locally, gitignored)
```

## `deck-theme-setup` (reduced scope)

The template provides colors/fonts/geometry at build time, so no extraction is needed.
This skill only records *which template to use* and *which layout to use for which role*.

- **`setup <template> <variantId> "<Variant Name>"`**: open the template, copy it into the
  skill's local `templates/` folder (self-contained — a moved original can't break it),
  enumerate its slide-layout names, and record a variant in `deck-config.json`.
- **`learn <example-deck> <variantId>`**: open an example deck; for each slide read its
  actual layout name (`slide.slide_layout.name`) and classify its role from the slide's
  title text; merge the resulting `role -> layout name` map into that variant. Re-uses the
  fixed role vocabulary (title, agenda, section, problem, solution, product, case-study,
  roi, next-steps, thank-you, content) and the keyword/position heuristic from v1.

If a template defines more than one slide master, each master's layouts are grouped; a
variant maps to one master. Multiple design variants (e.g. light/dark) are separate
template files, each its own variant entry.

## `deck-config.json` (replaces `theme.json`)

Holds only pointers and mappings — no colors, fonts, or geometry:

```jsonc
{
  "variants": [
    {
      "id": "brand-light",
      "name": "Brand — Light",
      "template": "templates/brand-light.pptx",
      "layouts": ["Title Slide", "Section Header", "Title and Content", "Two Content"],
      "rolePreferences": { "title": "Title Slide", "problem": "Two Content" }
    }
  ]
}
```

## `deck-builder` (faithful generator)

1. Read `deck-config.json`; list variant names; ask which to use.
2. Gather the brief in one round and pick a **persona** (executive, CISO, technical,
   discovery) that tunes tone/depth/role emphasis. (Personas carry over from v1.)
3. Claude drafts the full slide list as JSON — each slide has `role`, `title`, optional
   `subtitle`/`bullets`/`body`, and `imageCount`.
4. `build_deck.py` opens a **copy** of the variant's template and, per slide:
   - resolve the layout: `rolePreferences[role]` if its name still exists in the template,
     else a fallback (a body-bearing layout such as the template's "Title and Content",
     else the first layout); note any fallback in the run summary.
   - `add_slide(layout)` and fill placeholders **by type**: title text → title/ctrTitle
     placeholder, `subtitle` → subtitle placeholder, `bullets`/`body` → body placeholder
     (bullets as separate paragraphs).
   - picture placeholders: left as-is when `imageCount > 0` (native prompt), untouched
     otherwise.
5. Save to `decks/<client>-<date>.pptx` and report the path.

### Behavior details

- **Text overflow:** filled placeholders get word-wrap on and auto-size set to shrink text
  to fit, so long content scales down instead of spilling over the design.
- **Missing placeholder:** if a resolved layout lacks a placeholder a slide needs (e.g. no
  body placeholder for a bulleted slide), fall back to another layout that has it and note
  it in the summary.
- **Encrypted/invalid template:** detect a non-`.pptx` (not a zip) at setup and give a
  clear message (some managed/DLP browsers encrypt downloads in transit).

## Testing

`python-pptx` ships a default template whose layouts have known names ("Title Slide",
"Title and Content", "Section Header", "Two Content", …), so tests build against that real
template — no hand-crafted OOXML needed. Test-first with Python's built-in `unittest` (no
extra test dependency):

- `setup`: enumerates the template's layout names; copies the file into `templates/`.
- `learn`: reads a deck's slide→layout names and role classification into `rolePreferences`.
- `build_deck`: output opens as a valid `.pptx`; slides use the resolved layouts; title and
  body text land in the correct placeholders; overflow auto-size is applied.
- A cross-skill seam test: real `setup` output feeds `build_deck` end to end.

## Distribution

The company laptop needs **Python 3 + `pip install python-pptx`** (one-time) instead of
Node. `setup`/`learn`/`build_deck` are still driven conversationally through Claude Code;
the user never runs the scripts directly. README and install instructions updated.

## Open risks / assumptions

- Python 3 and `python-pptx` are installable on the company laptop (user-confirmed intent;
  the offline failure during the dry run was the personal laptop's sandbox, not the work
  machine).
- `python-pptx` fills placeholders reliably across real corporate templates; unusual
  placeholder configurations may need per-template fallback tuning, validated against the
  real file on the company laptop.
- Heavy per-slide custom graphics that live *on individual slides* (beyond the layout) are
  not reproduced by layout population; cloning exemplar slides remains a possible future
  enhancement if needed.
