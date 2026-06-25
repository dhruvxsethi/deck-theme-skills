# Deck Theme Skills

Two [Claude Code](https://docs.anthropic.com/en/docs/claude-code) skills that generate
client presentations using your **real corporate PowerPoint template** — Claude writes the
content, and each slide is built from your template's *own* layouts, so logos, brand bars,
and background graphics come through intact. No web app, no third-party SaaS, no AI image
generation, and nothing leaves your machine.

Most "AI deck generators" impose their own look and can't ingest a locked corporate
template. These do the opposite: they open *your* `.pptx`/`.potx` and pour Claude-written
content into its real layouts.

## Features

- **Uses your real template, not a theme clone.** Slides are built from the template's own
  layouts and masters, so logos, brand bars, fonts, colors, and background graphics are the
  genuine article — the output *is* the template with content poured into its placeholders.
- **Context-driven drafting.** Claude grounds the deck in whatever you give it — meeting /
  Zoom / Gong notes, call transcripts, client background, email threads, and the deal
  context (see [Context it can ingest](#context-it-can-ingest)).
- **Audience personas.** Tone, depth, length, and slide emphasis tune to the audience:
  **Executive**, **CISO**, **Technical deep-dive**, or **Discovery**. Claude infers one from
  your brief or you pick.
- **Speaker notes.** Each slide can carry a `notes` talk-track written into the slide's
  notes pane (presenter view / printouts) — the "why this slide, say this" track.
- **Learns your layout conventions.** Point `deck-theme-setup` at a few past decks and it
  infers which layout you use for which kind of slide (title, agenda, problem, solution,
  case-study, ROI, next-steps, thank-you…) and saves it as a role→layout map.
- **Multiple template variants.** Register more than one template (e.g. a light and a dark
  deck) and pick the variant per build.
- **Smart layout fallback.** A slide whose role has no learned preference falls back to a
  body-bearing layout, then to the first layout — so a deck always renders.
- **Auto-fit text.** Long bullets/body auto-shrink to fit their placeholder.
- **Iterative edits.** "Make slide 4 two-column," "shorten it for execs," "add an ROI
  slide from these numbers" → Claude re-drafts and regenerates.
- **Template validation.** Setup checks the file is a real `.pptx`/`.potx` and warns when a
  managed/DLP browser may have encrypted it in transit.
- **Fully local & private.** No web app, no third-party SaaS, no AI image generation, no
  internet or local LLM required — Claude writes the content and `python-pptx` renders it.
  Your template and config never leave your machine and are gitignored.

## How it works

```
┌────────────────────┐    writes      ┌──────────────────┐    reads       ┌───────────────┐
│  deck-theme-setup  │ ─────────────▶ │ deck-config.json │ ─────────────▶ │  deck-builder │
│  (run once)        │   + copies     │  (local)         │                │ (run anytime) │
└────────────────────┘   template     └──────────────────┘                └───────────────┘
   open template:                       template path,                      open template,
   list its layouts                     layout names,                       add slides from
   + learn role→layout                  role→layout map                     its layouts, fill
   from example decks                                                       text, save .pptx
```

1. **`deck-theme-setup`** (once): point it at your template. It copies the file locally,
   records its layout names, and (optionally) learns from past decks which layout you use
   for which kind of slide — into `deck-config.json`.
2. **`deck-builder`** (anytime): give it a brief or paste notes. Claude drafts the slides,
   opens your real template, adds slides from its actual layouts, fills the text, and
   writes a finished `.pptx`.

## Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (CLI is enough)
- Python 3 with `python-pptx` (`pip install python-pptx`)
- A copy of your corporate PowerPoint template (`.pptx` or `.potx`)

## Install

```bash
# 1. Get the skills (clone, or "Code → Download ZIP" on GitHub and unzip)
git clone https://github.com/dhruvxsethi/deck-theme-skills.git
cd deck-theme-skills

# 2. Copy the two skill folders to your Claude Code skills directory
cp -R deck-theme-setup deck-builder ~/.claude/skills/

# 3. Install the Python dependency in each (one time)
cd ~/.claude/skills/deck-theme-setup && pip install -r requirements.txt
cd ~/.claude/skills/deck-builder    && pip install -r requirements.txt
```

You never run the scripts yourself — talk to Claude and it runs them.

## Usage

1. **Set up your template (once):** say *"set up our deck theme"*. Claude asks for the
   template path, records its layouts, and offers to learn from a few past decks.
2. **Build a deck:** say *"build a deck for Acme, pitching their CISO"* (paste any notes).
   Claude picks the CISO persona, drafts the slides, and writes a `.pptx` into `decks/`.
3. **Iterate:** *"make slide 4 two-column"* / *"shorten it for execs"* → it re-drafts and
   regenerates.

### Context it can ingest

A presales/sales deck is only as good as the context behind it, so `deck-builder` actively
pulls in everything you can give it and folds it into the narrative. Provide any of these as
**pasted text** or a **local file path** (`.txt` / `.md` / `.docx` / `.pdf` — it reads the
file):

- **Meeting / Zoom / Gong call notes or transcripts** — it extracts the prospect's stated
  pains, priorities, quotes, objections, who was in the room, and any commitments made.
- **Client background** — industry, size, recent news, regulatory pressures, tech stack,
  competitors, and current vendors.
- **Email threads** — the ask, the timeline, the stakeholders and their roles.
- **The opportunity** — deal stage (discovery / eval / business case / negotiation), the
  champion, the economic buyer, success criteria, and the next step you're driving toward.
- **Prior decks or one-pagers** you want to draw from.

The more specific the input is to *this* client and *this* conversation, the better the
deck. With little context, Claude asks 2–3 sharp qualifying questions and proceeds. (There
is no live Zoom/Gong integration — paste the notes or pass a file path; it doesn't fetch
recordings from the cloud.)

### Or run the scripts directly

```bash
# Set up (from the deck-theme-setup folder) — extract layouts into deck-builder's config
python scripts/extract_layouts.py setup ./Corporate-Template.pptx brand-light "Brand — Light" ../deck-builder/deck-config.json

# (optional) Learn role→layout preferences from a real past deck
python scripts/extract_layouts.py learn ./examples/past-deck.pptx brand-light ../deck-builder/deck-config.json

# Build a deck (from the deck-builder folder)
python scripts/build_deck.py deck-config.json ./slides.json brand-light ./decks/acme-2026.pptx
```

`slides.json` is a JSON array of slides (Claude writes this for you):

```json
[
  { "role": "title",      "title": "Acme — Security Review", "subtitle": "June 2026" },
  { "role": "problem",    "title": "Current Challenges",     "bullets": ["Alert fatigue across siloed tools", "Mean-time-to-respond averaging ~4 days"], "notes": "Anchor on the MTTR gap — tie it back to the discovery call." },
  { "role": "solution",   "title": "A Unified Approach",     "bullets": ["Consolidate detection in one console", "Automate triage and response"] },
  { "role": "next-steps", "title": "Next Steps",             "bullets": ["Scoping workshop", "30-day pilot"] },
  { "role": "thank-you",  "title": "Thank You",              "subtitle": "Questions?" }
]
```

Each slide can also carry `notes` (a speaker talk-track written into the slide's notes
pane) and `imageCount`. Claude drafts all of this from your brief plus any context you
give it — pasted meeting/Zoom notes, a call transcript, client background, or a file path.

## `deck-config.json` shape

```jsonc
{
  "variants": [
    {
      "id": "brand-light",
      "name": "Brand — Light",
      "template": "templates/brand-light.pptx",
      "layouts": ["Title Slide", "Section Header", "Title and Content", "Two Content"],
      "rolePreferences": { "title": "Title Slide", "problem": "Title and Content" }
    }
  ]
}
```

It holds only pointers and mappings — the colors, fonts, and design come from the template
file itself at build time. `rolePreferences` maps a slide role to one of your real layout
names; `deck-builder` falls back to a body-bearing layout when a role has no preference.

## Personas

`deck-builder` tunes tone, depth, and slide emphasis by audience: **Executive**, **CISO**,
**Technical deep-dive**, **Discovery**. Claude picks one from your brief (or you choose) —
see `deck-builder/SKILL.md`.

## Limitations

- Per-slide custom graphics that live on an individual slide (beyond its layout) are not
  reproduced — only the template's layouts and masters are. Cloning specific designed
  slides is a possible future enhancement.
- The decorative chrome and the placeholder positions must be coordinated in the template
  (real corporate templates already are); a mismatched template can place text over
  graphics. Review the layouts reported by `setup` and adjust if needed.
- Very long content auto-shrinks to fit a placeholder; keep briefs tight for best results.

## Development

```bash
cd deck-theme-setup && pip install -r requirements.txt && python -m unittest discover -s tests -t .
cd deck-builder     && pip install -r requirements.txt && python -m unittest discover -s tests -t .
# from the repo root, the cross-skill seam test:
python -m unittest tests.test_seam
```

See `docs/superpowers/specs/2026-06-24-faithful-deck-generation-design.md` for the design.
