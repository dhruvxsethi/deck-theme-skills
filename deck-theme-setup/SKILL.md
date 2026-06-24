---
name: deck-theme-setup
description: Use when the user wants to set up, import, or update a corporate PowerPoint theme/layouts for deck generation — e.g. "set up our deck theme", "import our corporate template", "I have a new theme file to use".
---

# Deck Theme Setup

Registers a corporate PowerPoint template and learns which layout the user uses for which
kind of slide, writing it all to `deck-config.json` for the `deck-builder` skill. The real
design lives in the template file itself — this skill only records pointers and the
role→layout map.

## When to use

Run once when first setting up the corporate template, or again when the template changes.
It does not generate presentations — see `deck-builder`.

## Prerequisite

Needs Python 3 and `python-pptx`. If `python -c "import pptx"` fails, run
`pip install -r requirements.txt` in this folder first.

## Steps

`deck-config.json` and the copied templates must live next to the `deck-builder` skill so
that skill can find them. Pass paths into `deck-builder`'s folder (e.g.
`../deck-builder/deck-config.json`). Adjust the relative path to wherever `deck-builder` is
installed.

1. Ask the user for the path to a blank corporate theme file (`.pptx` or `.potx`).
2. If they downloaded it through a managed/secure browser, warn that some DLP tooling
   encrypts downloads in transit; the script will say clearly if the file isn't usable.
3. Pick a short id (e.g. `brand-light`) and a display name; confirm with the user.
4. Run (writing into the deck-builder skill's folder):
   ```
   python scripts/extract_layouts.py setup <template> <variantId> "<Variant Name>" ../deck-builder/deck-config.json
   ```
   This copies the template into `../deck-builder/templates/<variantId>.pptx` and records
   the variant with its layout names.
5. Report the layout names found and confirm they look right.
6. Ask for any real example decks using this template. For each, run:
   ```
   python scripts/extract_layouts.py learn <example-deck.pptx> <variantId> ../deck-builder/deck-config.json
   ```
   Report the learned role → layout mappings; let the user correct any by editing
   `deck-config.json`'s `rolePreferences`, or by asking you to.
7. Repeat for additional variants (e.g. a dark template) with a different id.
8. If the script reports the file doesn't look like a valid pptx, explain it may have been
   encrypted/altered in transit and to re-obtain it.

## Notes

- Never needs internet access.
- `deck-config.json` and `templates/` are local and derived from the user's internal
  template — they are gitignored; don't commit them anywhere shared.
