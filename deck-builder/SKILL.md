---
name: deck-builder
description: Use when the user wants to generate, build, or draft a branded client/sales presentation or deck — e.g. "generate a deck", "build a presentation for [client]", "make me a deck from these meeting notes / this call transcript / this client background".
---

# Deck Builder

Drafts a full client presentation and renders it into a real `.pptx` by opening the user's
real corporate template and adding slides built from its own layouts (set up via
`deck-theme-setup`). Logos, brand graphics, fonts, colors, and backgrounds all come from
the template itself — the output matches the corporate theme exactly because it *is* the
template, with content poured into its real placeholders.

## Prerequisites

- Python 3 and `python-pptx` (`pip install -r requirements.txt` in this folder if
  `python -c "import pptx"` fails).
- `deck-config.json` exists next to this skill. If not, tell the user to run
  `deck-theme-setup` first and stop here.

## Gather context first (this is what makes the deck good)

A presales/sales deck is only as strong as the context behind it. Before drafting, pull in
**everything the user can give you** and fold it into the narrative — don't ask for things
they've already provided. Actively offer to ingest:

- **Meeting / Zoom / Gong call notes or transcripts** — extract the prospect's stated pains,
  priorities, quotes, objections, who was in the room, and any commitments made.
- **Client background** — industry, size, recent news, regulatory pressures, their tech
  stack, competitors, and current vendors (from notes the user pastes or a file path).
- **Email threads** — the ask, the timeline, the stakeholders and their roles.
- **The opportunity** — deal stage (discovery / eval / business case / negotiation), the
  champion, the economic buyer, success criteria, and the next step you're driving toward.
- **Prior decks or one-pagers** the user wants to draw from.

Accept any of these as pasted text or a local file path (`.txt`/`.md`/`.docx`/`.pdf` — read
it). The more specific the deck is to *this* client and *this* conversation, the better.
If little context is available, ask 2–3 sharp qualifying questions, then proceed.

## Steps

All commands and paths are relative to this skill's folder, where `deck-config.json` and
`templates/` live.

1. Read `deck-config.json`, list the variant names, and ask which to use.
2. Gather the brief in one round, pulling from the context above: client name, industry,
   audience/persona (see Personas), goal, pain points, products of interest, target slide
   count (default 8–12). Infer the persona from the audience/context and confirm in one
   line rather than asking cold.
3. Draft the full slide list yourself, applying the persona's tuning and grounding every
   slide in the gathered context. Each slide is an object with:
   `role` (title, agenda, section, problem, solution, product, case-study, roi,
   next-steps, thank-you, content), `title`, optional `subtitle`/`bullets`/`body`,
   optional `notes` (speaker talk-track), and optional `imageCount`.
   - First slide: role `title`. Include at least one `problem` grounded in *their* stated
     pains, one `solution`/`product` mapping your capabilities to those pains, ideally a
     `case-study` or `roi` slide, and close with `next-steps` (a concrete mutual action)
     and `thank-you`.
   - **Write real substance.** Each bullet should carry a point, not a label — a short
     headline idea, and where it helps, a supporting clause with a number, a name, or a
     consequence drawn from the context. Aim for 3–5 bullets per content slide. Tighten
     for Executive, go deeper for Technical.
   - Add `notes` with the talking points for the presenter (the "why this slide, say this"
     track) — especially for problem, solution, roi, and next-steps slides.
4. Write the drafted slides to a temporary JSON file:
   ```json
   [
     { "role": "title", "title": "...", "subtitle": "..." },
     { "role": "problem", "title": "...", "bullets": ["...", "..."], "notes": "Talk track..." }
   ]
   ```
5. Run:
   ```
   python scripts/build_deck.py deck-config.json <slides.json> <variantId> decks/<client>-<date>.pptx
   ```
   `<variantId>` is the short id from `deck-config.json`, not the display name.
6. Tell the user the deck is ready and where it is.
7. For edits ("make slide 4 two-column," "shorten for execs," "add an ROI slide from these
   numbers"), update the draft, rewrite the slides JSON, and re-run step 5.

## Personas

A persona tunes *how you write* — tone, depth, role emphasis, length, and which proof
points to lead with. Ask or infer from the audience/context; default to Executive.

- **Executive / business case** — CxO, VP, board. Lead with business outcomes, risk
  reduction, and ROI/TCO; minimal jargon. Emphasize `problem`, `solution`, `roi`,
  `next-steps`. ~6–9 slides, ≤4 tight bullets each, strong notes for the verbal story.
- **CISO / security leadership** — frame around threat landscape, risk posture, compliance
  obligations, and SOC/operational impact. Emphasize `problem`, `solution`, `case-study`,
  `roi`. ~8–11 slides. Use their stack and regulators from the context.
- **Technical deep-dive** — architects, engineers, security ops. Architecture,
  integrations, data flows, deployment, and how it actually works. Emphasize `solution`,
  `product`, `case-study`, plus extra `content`. ~10–14 slides, 5–6 bullets ok.
- **Discovery / first meeting** — broad, benefit-led, light on detail. Strong `agenda` and
  `next-steps`; emphasize `agenda`, `problem`, `solution`, `next-steps`. ~6–8 slides;
  leave room for questions rather than telling everything.

If the audience doesn't fit cleanly, pick the closest, say which you chose, and adapt. The
user can always say "make it more technical" or "shorten it for the CFO" and you re-draft.

## Notes

- Never needs internet access or any local LLM — you (Claude) write the content directly.
- The output matches the corporate theme exactly: fonts, colors, sizes, logos, and
  backgrounds all come from the template's own layouts. Keep bullet counts/length within
  what each layout comfortably holds; long text auto-shrinks to fit, but the right move is
  to size the content to the slide.
- No AI image generation. Picture placeholders in the chosen layout are left as the
  template's own native prompt; nothing is drawn into them.
- `section` and `product` may have no learned layout preference (the classifier never
  produces them); they fall back to a body-bearing layout unless set in `rolePreferences`.
