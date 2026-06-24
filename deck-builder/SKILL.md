---
name: deck-builder
description: Use when the user wants to generate, build, or draft a branded client presentation/deck — e.g. "generate a deck", "build a presentation for [client]", "make me a deck from these meeting notes".
---

# Deck Builder

Drafts a full client presentation and renders it into a real `.pptx` by opening the user's
real corporate template and adding slides built from its own layouts (set up via
`deck-theme-setup`). Logos, brand graphics, and backgrounds come from the template itself.

## Prerequisites

- Python 3 and `python-pptx` (`pip install -r requirements.txt` in this folder if
  `python -c "import pptx"` fails).
- `deck-config.json` exists next to this skill. If not, tell the user to run
  `deck-theme-setup` first and stop here.

## Steps

All commands and paths are relative to this skill's folder, where `deck-config.json` and
`templates/` live.

1. Read `deck-config.json`, list the variant names, and ask which to use.
2. Gather the brief in one round: client name, industry, audience/persona (see Personas),
   goal, pain points, products of interest, target slide count (default 8-12). Accept
   pasted notes or a notes file path. Infer the persona from the audience and confirm in
   one line rather than asking cold.
3. Draft the full slide list yourself, applying the persona's tuning. Each slide:
   `role` (title, agenda, section, problem, solution, product, case-study, roi,
   next-steps, thank-you, content), `title`, optional `subtitle`/`bullets`/`body`, and
   `imageCount`.
   - First slide: role `title`. Include at least one `problem` and one `solution`/`product`
     slide, and close with `next-steps` and `thank-you`.
   - Write as much substance as the brief and persona warrant — bullets can carry real
     detail (a headline plus a clause). Keep each bullet to one idea; lean tighter for the
     Executive persona, richer for Technical.
4. Write the slides to a temporary JSON file:
   ```json
   [
     { "role": "title", "title": "...", "subtitle": "..." },
     { "role": "problem", "title": "...", "bullets": ["...", "..."] }
   ]
   ```
5. Run:
   ```
   python scripts/build_deck.py deck-config.json <slides.json> <variantId> decks/<client>-<date>.pptx
   ```
   `<variantId>` is the short id from `deck-config.json`, not the display name.
6. Tell the user the deck is ready and where it is.
7. For edits ("make slide 4 two-column," "shorten for execs"), update the draft, rewrite
   the slides JSON, and re-run step 5.

## Personas

A persona tunes *how you write* — tone, depth, role emphasis, length. Ask or infer;
default to Executive.

- **Executive / business case** — CxO/board. Outcomes, risk, ROI/TCO; minimal jargon.
  Emphasize `problem`, `solution`, `roi`, `next-steps`. ~6-9 slides, ≤4 tight bullets.
- **CISO / security leadership** — threat landscape, risk posture, compliance, ops impact.
  Emphasize `problem`, `solution`, `case-study`, `roi`. ~8-11 slides.
- **Technical deep-dive** — architects/engineers. Architecture, integrations, deployment.
  Emphasize `solution`, `product`, `case-study`, extra `content`. ~10-14 slides, deeper.
- **Discovery / first meeting** — broad, benefit-led, light on detail. Emphasize `agenda`,
  `problem`, `solution`, `next-steps`. ~6-8 slides.

## Notes

- Never needs internet access or any local LLM — you (Claude) write the content directly.
- Long text auto-shrinks to fit a placeholder (word-wrap + auto-fit), so content scales
  rather than spilling over the design.
- No AI image generation. Picture placeholders in the chosen layout are left as the
  template's own native prompt; nothing is drawn into them.
- `section` and `product` may have no learned layout preference (the classifier never
  produces them); they fall back to a body-bearing layout unless set in `rolePreferences`.
