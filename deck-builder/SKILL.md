---
name: deck-builder
description: Use when the user wants to generate, build, or draft a branded client presentation/deck — e.g. "generate a deck", "build a presentation for [client]", "make me a deck from these meeting notes".
---

# Deck Builder

Drafts a full client presentation and renders it into a real `.pptx` file using the
user's real corporate theme and layouts (set up via the `deck-theme-setup` skill).

## Prerequisites

Check that `theme.json` exists next to this skill. If it doesn't, tell the user to run
the `deck-theme-setup` skill first and stop here.

## Steps

All commands and paths below are relative to this skill's folder — run them from there
(the directory containing this SKILL.md), where `theme.json` lives.

1. Read `theme.json` and list the available theme variant names to the user; ask which
   one to use for this deck.
2. Gather the brief in one upfront round — ask for whatever of the following the user
   hasn't already given you: client name, industry, **audience / persona** (see the
   Personas section below), goal, known pain points, products/solutions of interest,
   target slide count (default 8-12). Also accept (optional) pasted meeting notes/email
   thread, or a path to a local notes file — fold that directly into your understanding
   rather than asking redundant questions. If the audience is obvious from the brief
   (e.g. "pitching their CISO"), infer the persona and confirm it in one line rather
   than asking cold.
3. Draft the full slide-by-slide outline yourself, in one pass, **applying the chosen
   persona's tuning** (tone, depth, which roles to emphasize, default length). For each
   slide decide: `role` (one of: title, agenda, section, problem, solution, product,
   case-study, roi, next-steps, thank-you, content), `title`, optional
   `subtitle`/`bullets`/`body`, and `imageCount` (0 unless the user asked for image
   space on that slide).
   - First slide: role `title`.
   - Always include at least one `problem` slide grounded in the stated pain points, at
     least one `solution`/`product` slide mapping your product capabilities to those pain
     points, and close with `next-steps` and `thank-you`.
   - Keep bullets concise (under ~12 words each) unless the persona or user asks for more
     depth.
   - Note: `section` and `product` have no learned layout preference (the theme-setup
     classifier never produces them), so they fall back to a generic layout unless you
     set a `rolePreference` for them manually in `theme.json`.
4. Write the drafted slides to a temporary JSON file matching this shape:
   ```json
   [
     { "role": "title", "title": "...", "subtitle": "..." },
     { "role": "problem", "title": "...", "bullets": ["...", "..."] }
   ]
   ```
5. Run:
   ```
   node scripts/generate-pptx.js theme.json <slides.json> <variantId> <output-path>.pptx
   ```
   `<variantId>` is the short id from `theme.json` (the one chosen in `deck-theme-setup`),
   not the display name. Pick `<output-path>` under a `decks/` folder next to this skill,
   named from the client name and today's date (e.g. `decks/acme-corp-2026-06-23.pptx`).
6. Tell the user the deck is ready and where the file is.
7. For edit requests ("make slide 4 two-column," "punch up slide 2"), update your
   in-memory draft, rewrite the slides JSON, and re-run step 5 to regenerate the file.

## Personas

A persona tunes *how you write the content* — tone, depth, which slide roles to
emphasize, and default length. It does not change the layouts or theme. Ask the user to
pick one (or infer it from the audience and confirm). Default to **Executive** if
unspecified.

- **Executive / business case** — audience: CxO, VP, board. Lead with outcomes, risk
  reduction, and ROI/TCO; minimal jargon. Emphasize `problem`, `solution`, `roi`,
  `next-steps`. Fewer, denser slides (~6-9); ≤4 bullets/slide, short and declarative.
- **CISO / security leadership** — audience: CISO, security directors. Frame around
  threat landscape, risk posture, compliance, and operational impact. Emphasize
  `problem`, `solution`, `case-study`, `roi`. Moderate depth (~8-11 slides);
  security-outcome language over feature lists.
- **Technical deep-dive** — audience: architects, engineers, security operations. Cover
  architecture, integrations, deployment, and how it actually works. Emphasize
  `solution`, `product`, `case-study`, plus extra `content` slides. More depth per slide
  (5-6 bullets ok, longer `body` allowed); ~10-14 slides.
- **Discovery / first meeting** — audience: mixed, early-stage. Broad and benefit-led,
  light on detail, strong `agenda` and `next-steps`. Emphasize `agenda`, `problem`,
  `solution`, `next-steps`. Shorter (~6-8 slides); leave room to ask questions rather
  than tell everything.

If the user describes an audience that doesn't fit cleanly, pick the closest persona,
say which you chose, and adapt. The user can always say "make it more technical" or
"shorten it for execs" and you re-draft.

## Notes

- This skill never needs internet access or any local LLM — you (Claude) write the
  content directly.
- No AI image generation. `imageCount` only reserves a labeled placeholder box on
  layouts that actually have a picture placeholder; it does nothing on layouts without
  one.
