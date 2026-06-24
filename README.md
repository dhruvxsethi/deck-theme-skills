# Deck Theme Skills

Two [Claude Code](https://docs.anthropic.com/en/docs/claude-code) skills that generate
client presentations using your **real corporate PowerPoint theme and layouts** — with
Claude writing the slide content directly. No web app, no third-party SaaS, no AI image
generation, and nothing ever leaves your machine.

Most "AI deck generators" impose their own look and can't ingest a locked corporate
template. These skills do the opposite: they read the colors, fonts, and named slide
layouts out of *your* `.pptx`/`.potx` template and produce decks that match it.

---

## How it works

```
┌─────────────────────┐     writes      ┌──────────────┐     reads      ┌────────────────┐
│  deck-theme-setup   │ ──────────────▶ │  theme.json  │ ─────────────▶ │  deck-builder  │
│  (run once)         │                 │  (local)     │                │  (run anytime) │
└─────────────────────┘                 └──────────────┘                └────────────────┘
   parse a .pptx/.potx:                   colors, fonts,                   draft slides +
   colors · fonts · layouts               layouts, learned                 render a real
   + learn role→layout                    role preferences                 .pptx file
   from example decks
```

1. **`deck-theme-setup`** (one-time): point it at a blank copy of your corporate template.
   It extracts the 12-color theme, fonts, and every named slide layout (with placeholder
   geometry) into `theme.json`. Optionally point it at a few real past decks so it learns
   *which layout you tend to use for which kind of slide* (title, problem, solution,
   case study, next steps, …).
2. **`deck-builder`** (repeatable): give it a short brief or paste meeting notes. Claude
   drafts the full slide outline, maps each slide to one of your real layouts, and writes
   a finished `.pptx` you open in PowerPoint.

---

## Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (CLI is enough — no GUI app needed)
- Node.js 18+ (tested on Node 24)
- A copy of your corporate PowerPoint template (`.pptx` or `.potx`)

---

## Install

Get the skills onto the machine where you'll build decks (e.g. your work laptop), copy
them into your Claude Code skills directory, and install dependencies:

```bash
# 1. Get the skills (clone, or "Code → Download ZIP" on GitHub and unzip)
git clone https://github.com/dhruvxsethi/deck-theme-skills.git
cd deck-theme-skills

# 2. Copy the two skill folders to your Claude Code skills directory
cp -R deck-theme-setup deck-builder ~/.claude/skills/

# 3. Install dependencies in each (one time)
cd ~/.claude/skills/deck-theme-setup && npm install
cd ~/.claude/skills/deck-builder    && npm install
```

That's it. Claude Code auto-discovers the skills from their `SKILL.md` files — you never
run the scripts yourself; you just talk to Claude (see Usage below) and it runs them.

> The skill folders contain only instructions and small Node.js scripts — nothing
> sensitive — so they're safe to move however you normally move files between your own
> devices (cloud drive, AirDrop, USB, `git clone`, …).

> The skill folders contain only instructions and small Node.js scripts — nothing
> sensitive — so they're safe to move however you normally move files between your own
> devices (cloud drive, AirDrop, USB, `git clone`, …).

---

## Usage

### Step 1 — set up your theme (once)

In Claude Code, just say: **"set up our deck theme"** and follow the prompts, or run the
script directly from the `deck-theme-setup` folder:

```bash
# Extract colors, fonts, and layouts from your template into theme.json
node scripts/extract-theme.js setup ./Corporate-Template.pptx brand-light "Brand — Light" theme.json

# (optional) Learn role→layout preferences from a real past deck
node scripts/extract-theme.js learn ./examples/past-deck.pptx brand-light theme.json
```

Repeat for additional variants (e.g. a dark theme) with a different `<variantId>`.

### Step 2 — build a deck (anytime)

Say: **"build a deck for Acme Corp"** (and paste any notes), or run from the
`deck-builder` folder after copying your `theme.json` next to it:

```bash
node scripts/generate-pptx.js theme.json ./slides.json brand-light ./decks/acme-2026.pptx
```

where `slides.json` is an array of slides (Claude writes this for you):

```json
[
  { "role": "title",     "title": "Acme — Security Review", "subtitle": "June 2026" },
  { "role": "problem",   "title": "Current Challenges",     "bullets": ["Alert fatigue", "Slow response"] },
  { "role": "solution",  "title": "Proposed Approach",      "bullets": ["Unify tooling", "Automate triage"] },
  { "role": "next-steps","title": "Next Steps",             "bullets": ["Scoping workshop", "30-day pilot"] },
  { "role": "thank-you", "title": "Thank You",              "subtitle": "Questions?" }
]
```

---

## `theme.json` shape

```jsonc
{
  "variants": [
    {
      "id": "brand-light",
      "name": "Brand — Light",
      "colors": { "dk1": "#000000", "lt1": "#FFFFFF", "accent1": "#...", "...": "..." },
      "fonts": { "major": "Calibri Light", "minor": "Calibri" },
      "layouts": [
        { "name": "Title Slide", "placeholders": [
          { "type": "title", "x": 0.7, "y": 2.2, "w": 8.3, "h": 1.2 }
        ] }
      ],
      "rolePreferences": { "title": "Title Slide", "problem": "Two Content" }
    }
  ]
}
```

Positions are in inches. `rolePreferences` maps a slide role to one of your real layout
names; `deck-builder` falls back to a sensible layout when a role has no preference.

---

## Known limitation

PowerPoint layouts can inherit placeholder positions from their parent slide *master*
rather than defining their own. This extractor records only placeholders with explicit
geometry, so master-inherited placeholders come through empty and those layouts fall
back to default positioning. Resolving full master inheritance is a planned improvement.
Run `deck-theme-setup` against your real template first and review the reported layouts —
if some come back with no placeholders, that's this limitation.

---

## Development

```bash
cd deck-builder      && npm install && node --test "scripts/**/*.test.js"
cd deck-theme-setup  && npm install && node --test "scripts/**/*.test.js"
# from the repo root, after installing both, the cross-skill seam test:
node --test "tests/**/*.test.js"
```

`tests/seam.test.js` runs real `extract-theme.js` output through `generate-pptx.js` end
to end, guarding the `theme.json` contract the two skills share.

(The quoted glob is needed because on Node 24+ a bare `node --test scripts/` treats
`scripts/` as a single module to run rather than a directory to scan for tests.)
