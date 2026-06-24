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
   hasn't already given you: client name, industry, audience, goal, known pain points,
   products/solutions of interest, target slide count (default 8-12). Also accept
   (optional) pasted meeting notes/email thread, or a path to a local notes file — fold
   that directly into your understanding rather than asking redundant questions.
3. Draft the full slide-by-slide outline yourself, in one pass. For each slide decide:
   `role` (one of: title, agenda, section, problem, solution, product, case-study, roi,
   next-steps, thank-you, content), `title`, optional `subtitle`/`bullets`/`body`, and
   `imageCount` (0 unless the user asked for image space on that slide).
   - First slide: role `title`.
   - Always include at least one `problem` slide grounded in the stated pain points, at
     least one `solution`/`product` slide mapping your product capabilities to those pain
     points, and close with `next-steps` and `thank-you`.
   - Keep bullets concise (under ~12 words each) unless the user asks for more depth.
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

## Notes

- This skill never needs internet access or any local LLM — you (Claude) write the
  content directly.
- No AI image generation. `imageCount` only reserves a labeled placeholder box on
  layouts that actually have a picture placeholder; it does nothing on layouts without
  one.
