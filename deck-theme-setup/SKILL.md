---
name: deck-theme-setup
description: Use when the user wants to set up, import, or update a corporate PowerPoint theme/layouts for deck generation — e.g. "set up our deck theme", "import our corporate template", "I have a new theme file to use".
---

# Deck Theme Setup

Extracts real PowerPoint theme colors and slide layouts from a template file the user
provides, and (optionally) learns which layout they use for which kind of slide from
real example decks. Saves everything to `theme.json` next to this skill, for the
`deck-builder` skill to read.

## When to use

Run this once when the user first sets up their corporate theme, or again whenever their
template changes. It does not generate any presentation itself — see `deck-builder` for
that.

## Steps

All commands and paths below are relative to this skill's folder — run them from there
(the directory containing this SKILL.md), so `theme.json` is created and read in the
same place `deck-builder` looks for it.

1. Ask the user for the path to a blank corporate theme file (`.pptx` or `.potx`).
2. If the user mentions downloading it through a secure/managed browser, warn them that
   some data-loss-prevention (DLP) tooling encrypts downloads in transit, and that the
   extraction script will say clearly if the file isn't usable rather than failing
   silently.
3. Pick a short id (e.g. `brand-light`) and a display name for this variant — ask the
   user to confirm, or suggest a name based on the filename if unclear.
4. Run:
   ```
   node scripts/extract-theme.js setup <path-to-file> <variantId> "<Variant Name>" theme.json
   ```
5. Report the script's output to the user (number of layouts found, their names and
   placeholder types) and confirm it looks right.
6. Ask if they have any real example decks (already using this corporate theme) they can
   point to, to teach the role-to-layout mapping. For each one provided, run:
   ```
   node scripts/extract-theme.js learn <path-to-example-deck.pptx> <variantId> theme.json
   ```
   Report the learned role -> layout mappings and let the user correct any that look
   wrong by editing `theme.json`'s `rolePreferences` for that variant, or asking you to.
7. Repeat steps 3-6 for any additional theme variants (e.g. a "Dark" version saved as a
   separate file).
8. If the extraction script reports the file doesn't look like a valid pptx, explain
   that it may have been altered/encrypted in transit (e.g. by a secure browser's DLP
   policy) and that the user should re-obtain it through a different route.

## Notes

- This skill never needs internet access.
- `theme.json` is local to this machine and derived from the user's internal corporate
  template — don't suggest committing it to any shared repository.
