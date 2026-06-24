# Faithful Deck Generation (Strategy B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **EXECUTION REQUIREMENT:** This plan needs `python-pptx` installed (`pip install python-pptx`). Run it on a machine with PyPI access. Verify before starting: `python3 -c "import pptx; print(pptx.__version__)"`.

**Goal:** Replace the Node deck generator with a Python (`python-pptx`) one that produces decks which *are* the corporate design — by opening the real template and adding slides built from its own layouts, then filling Claude-drafted text into the layout placeholders.

**Architecture:** Two Python skills. `deck-theme-setup/scripts/extract_layouts.py` copies a template locally, lists its layout names, and learns role→layout from example decks into `deck-config.json`. `deck-builder/scripts/build_deck.py` opens a copy of that template, adds slides from its real layouts, and fills placeholders by type. The Node scripts and their deps are removed.

**Tech Stack:** Python 3, `python-pptx`, Python's built-in `unittest` (no extra test deps).

---

## Task 1: Scaffold the Python skills and remove the Node implementation

**Files:**
- Create: `deck-theme-setup/requirements.txt`
- Create: `deck-builder/requirements.txt`
- Create: `deck-theme-setup/scripts/__init__.py` (empty), `deck-builder/scripts/__init__.py` (empty)
- Modify: `.gitignore`
- Delete: `deck-theme-setup/package.json`, `deck-theme-setup/package-lock.json`, `deck-theme-setup/scripts/extract-theme.js`, `deck-theme-setup/scripts/extract-theme.test.js`, `deck-theme-setup/.gitignore`
- Delete: `deck-builder/package.json`, `deck-builder/package-lock.json`, `deck-builder/scripts/generate-pptx.js`, `deck-builder/scripts/generate-pptx.test.js`, `deck-builder/.gitignore`
- Delete: `tests/seam.test.js`

- [ ] **Step 1: Create `deck-theme-setup/requirements.txt`**

```
python-pptx>=0.6.23
```

- [ ] **Step 2: Create `deck-builder/requirements.txt`**

```
python-pptx>=0.6.23
```

- [ ] **Step 3: Create empty package markers**

Create `deck-theme-setup/scripts/__init__.py` and `deck-builder/scripts/__init__.py` as empty files.

- [ ] **Step 4: Replace root `.gitignore`**

```
__pycache__/
*.pyc
.venv/
.DS_Store
**/templates/
**/decks/
deck-config.json
```

- [ ] **Step 5: Remove the Node implementation**

```bash
git rm deck-theme-setup/package.json deck-theme-setup/package-lock.json \
       deck-theme-setup/scripts/extract-theme.js deck-theme-setup/scripts/extract-theme.test.js \
       deck-theme-setup/.gitignore \
       deck-builder/package.json deck-builder/package-lock.json \
       deck-builder/scripts/generate-pptx.js deck-builder/scripts/generate-pptx.test.js \
       deck-builder/.gitignore \
       tests/seam.test.js
```

- [ ] **Step 6: Install the dependency and verify**

```bash
cd deck-theme-setup && pip install -r requirements.txt && cd ..
cd deck-builder && pip install -r requirements.txt && cd ..
python3 -c "import pptx; print('python-pptx', pptx.__version__)"
```
Expected: prints a version string.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Scaffold Python skills and remove the Node implementation"
```

---

## Task 2: Slide role classifier (pure function)

**Files:**
- Create: `deck-theme-setup/scripts/extract_layouts.py`
- Create: `deck-theme-setup/tests/__init__.py` (empty)
- Create: `deck-theme-setup/tests/test_extract_layouts.py`

- [ ] **Step 1: Write the failing test**

`deck-theme-setup/tests/test_extract_layouts.py`:
```python
import unittest
from scripts.extract_layouts import classify_slide_role


class TestClassifySlideRole(unittest.TestCase):
    def test_matches_keywords(self):
        self.assertEqual(classify_slide_role("Agenda", 1, 8), "agenda")
        self.assertEqual(classify_slide_role("Thank You", 7, 8), "thank-you")
        self.assertEqual(classify_slide_role("Next Steps", 6, 8), "next-steps")
        self.assertEqual(classify_slide_role("Current Challenges", 2, 8), "problem")
        self.assertEqual(classify_slide_role("Our Solution", 3, 8), "solution")
        self.assertEqual(classify_slide_role("Customer Success Story", 4, 8), "case-study")
        self.assertEqual(classify_slide_role("Return on Investment", 5, 8), "roi")

    def test_position_fallback(self):
        self.assertEqual(classify_slide_role("Welcome", 0, 8), "title")
        self.assertEqual(classify_slide_role("Goodbye", 7, 8), "thank-you")

    def test_content_fallback(self):
        self.assertEqual(classify_slide_role("Platform Overview", 3, 8), "content")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd deck-theme-setup && python -m unittest tests.test_extract_layouts -v`
Expected: FAIL — `ModuleNotFoundError` / `ImportError: cannot import name 'classify_slide_role'`.

- [ ] **Step 3: Implement the classifier**

`deck-theme-setup/scripts/extract_layouts.py`:
```python
"""deck-theme-setup: list a template's layouts and learn role->layout mappings."""

import re

ROLE_KEYWORDS = [
    ("agenda", [r"agenda", r"what we.?ll cover"]),
    ("next-steps", [r"next steps"]),
    ("thank-you", [r"thank you", r"questions\?"]),
    ("problem", [r"challenge", r"problem", r"pain point", r"current state"]),
    ("solution", [r"solution", r"how we help", r"our approach"]),
    ("case-study", [r"case study", r"success stor", r"customer story"]),
    ("roi", [r"\broi\b", r"return on investment", r"business case"]),
]


def classify_slide_role(title, slide_index, total_slides):
    text = title or ""
    for role, patterns in ROLE_KEYWORDS:
        if any(re.search(p, text, re.IGNORECASE) for p in patterns):
            return role
    if slide_index == 0:
        return "title"
    if slide_index == total_slides - 1:
        return "thank-you"
    return "content"
```

Also create `deck-theme-setup/tests/__init__.py` as an empty file.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd deck-theme-setup && python -m unittest tests.test_extract_layouts -v`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add deck-theme-setup/scripts/extract_layouts.py deck-theme-setup/tests/__init__.py deck-theme-setup/tests/test_extract_layouts.py
git commit -m "extract_layouts: classify a slide's role from title and position"
```

---

## Task 3: Template validity check and layout listing

**Files:**
- Modify: `deck-theme-setup/scripts/extract_layouts.py`
- Modify: `deck-theme-setup/tests/test_extract_layouts.py`

- [ ] **Step 1: Add the failing tests**

Append to `deck-theme-setup/tests/test_extract_layouts.py` (and add the imports `import os`, `import tempfile`, `from pptx import Presentation` at the top):
```python
class TestTemplateInspection(unittest.TestCase):
    def _default_template(self):
        # python-pptx ships a default template with standard named layouts.
        fd, path = tempfile.mkstemp(suffix=".pptx")
        os.close(fd)
        Presentation().save(path)
        return path

    def test_is_valid_pptx_true_for_real_pptx(self):
        from scripts.extract_layouts import is_valid_pptx
        path = self._default_template()
        self.addCleanup(os.remove, path)
        self.assertTrue(is_valid_pptx(path))

    def test_is_valid_pptx_false_for_non_zip(self):
        from scripts.extract_layouts import is_valid_pptx
        fd, path = tempfile.mkstemp(suffix=".pptx")
        os.write(fd, b"\xe5\xe4\x88\xdb not a zip")
        os.close(fd)
        self.addCleanup(os.remove, path)
        self.assertFalse(is_valid_pptx(path))

    def test_list_template_layouts_returns_standard_names(self):
        from scripts.extract_layouts import list_template_layouts
        path = self._default_template()
        self.addCleanup(os.remove, path)
        names = list_template_layouts(path)
        self.assertIn("Title Slide", names)
        self.assertIn("Title and Content", names)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd deck-theme-setup && python -m unittest tests.test_extract_layouts -v`
Expected: FAIL — `ImportError` for `is_valid_pptx` / `list_template_layouts`.

- [ ] **Step 3: Implement the functions**

Add to `deck-theme-setup/scripts/extract_layouts.py` (add `from pptx import Presentation` near the top):
```python
from pptx import Presentation


def is_valid_pptx(path):
    """A .pptx/.potx is a zip; its first two bytes are the 'PK' signature."""
    with open(path, "rb") as f:
        return f.read(2) == b"PK"


def list_template_layouts(template_path):
    """Return the layout names from the template's first slide master."""
    prs = Presentation(template_path)
    return [layout.name for layout in prs.slide_layouts]
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd deck-theme-setup && python -m unittest tests.test_extract_layouts -v`
Expected: PASS — 6 tests total.

- [ ] **Step 5: Commit**

```bash
git add deck-theme-setup/scripts/extract_layouts.py deck-theme-setup/tests/test_extract_layouts.py
git commit -m "extract_layouts: validate a pptx and list its layout names"
```

---

## Task 4: `setup` — copy template and write config

**Files:**
- Modify: `deck-theme-setup/scripts/extract_layouts.py`
- Modify: `deck-theme-setup/tests/test_extract_layouts.py`

- [ ] **Step 1: Add the failing tests**

Append to `deck-theme-setup/tests/test_extract_layouts.py` (add `import json`, `import shutil` at the top):
```python
class TestRunSetup(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.dir)
        self.template = os.path.join(self.dir, "src-template.pptx")
        Presentation().save(self.template)
        self.config = os.path.join(self.dir, "deck-config.json")
        self.templates_dir = os.path.join(self.dir, "templates")

    def test_setup_writes_variant_and_copies_template(self):
        from scripts.extract_layouts import run_setup
        variant = run_setup(self.template, "brand-light", "Brand — Light",
                            self.config, self.templates_dir)
        self.assertEqual(variant["id"], "brand-light")
        self.assertIn("Title Slide", variant["layouts"])
        self.assertEqual(variant["rolePreferences"], {})
        # template copied into templates_dir
        copied = os.path.join(self.templates_dir, "brand-light.pptx")
        self.assertTrue(os.path.exists(copied))
        # config written with the variant
        with open(self.config) as f:
            cfg = json.load(f)
        self.assertEqual(len(cfg["variants"]), 1)
        self.assertEqual(cfg["variants"][0]["id"], "brand-light")

    def test_setup_replaces_same_id_variant(self):
        from scripts.extract_layouts import run_setup
        run_setup(self.template, "brand-light", "First", self.config, self.templates_dir)
        run_setup(self.template, "brand-light", "Second", self.config, self.templates_dir)
        with open(self.config) as f:
            cfg = json.load(f)
        self.assertEqual(len(cfg["variants"]), 1)
        self.assertEqual(cfg["variants"][0]["name"], "Second")

    def test_setup_rejects_non_pptx(self):
        from scripts.extract_layouts import run_setup
        bad = os.path.join(self.dir, "bad.pptx")
        with open(bad, "wb") as f:
            f.write(b"\xe5\xe4\x88\xdb")
        with self.assertRaisesRegex(ValueError, "doesn't look like a real"):
            run_setup(bad, "x", "X", self.config, self.templates_dir)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd deck-theme-setup && python -m unittest tests.test_extract_layouts -v`
Expected: FAIL — `ImportError` for `run_setup`.

- [ ] **Step 3: Implement `run_setup`**

Add to `deck-theme-setup/scripts/extract_layouts.py` (add `import json`, `import os`, `import shutil` near the top):
```python
import json
import os
import shutil


def _load_config(config_path):
    if os.path.exists(config_path):
        with open(config_path) as f:
            config = json.load(f)
    else:
        config = {"variants": []}
    if not isinstance(config.get("variants"), list):
        raise ValueError(f'Config at "{config_path}" is missing a valid "variants" array.')
    return config


def run_setup(template_path, variant_id, variant_name, config_path, templates_dir):
    if not is_valid_pptx(template_path):
        raise ValueError(
            f'"{template_path}" doesn\'t look like a real .pptx/.potx file (no zip '
            f"signature). It may have been encrypted or corrupted in transit — re-obtain it."
        )
    os.makedirs(templates_dir, exist_ok=True)
    dest = os.path.join(templates_dir, f"{variant_id}.pptx")
    shutil.copyfile(template_path, dest)

    config = _load_config(config_path)
    config["variants"] = [v for v in config["variants"] if v.get("id") != variant_id]
    config_dir = os.path.dirname(os.path.abspath(config_path))
    variant = {
        "id": variant_id,
        "name": variant_name,
        "template": os.path.relpath(dest, config_dir),
        "layouts": list_template_layouts(dest),
        "rolePreferences": {},
    }
    config["variants"].append(variant)
    with open(config_path, "w") as f:
        json.dump(config, f, indent=2)
    return variant
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd deck-theme-setup && python -m unittest tests.test_extract_layouts -v`
Expected: PASS — 9 tests total.

- [ ] **Step 5: Commit**

```bash
git add deck-theme-setup/scripts/extract_layouts.py deck-theme-setup/tests/test_extract_layouts.py
git commit -m "extract_layouts: setup mode copies template and writes deck-config.json"
```

---

## Task 5: `learn` — map role→layout from an example deck, plus the CLI

**Files:**
- Modify: `deck-theme-setup/scripts/extract_layouts.py`
- Modify: `deck-theme-setup/tests/test_extract_layouts.py`

- [ ] **Step 1: Add the failing tests**

Append to `deck-theme-setup/tests/test_extract_layouts.py`:
```python
class TestLearn(unittest.TestCase):
    def _example_deck(self, dir_):
        prs = Presentation()
        layouts = {l.name: l for l in prs.slide_layouts}
        s1 = prs.slides.add_slide(layouts["Title Slide"])
        s1.shapes.title.text = "Welcome to Acme"
        s2 = prs.slides.add_slide(layouts["Title and Content"])
        s2.shapes.title.text = "Current Challenges"
        path = os.path.join(dir_, "example.pptx")
        prs.save(path)
        return path

    def test_learn_maps_role_to_actual_layout(self):
        from scripts.extract_layouts import learn_role_mapping
        d = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, d)
        mapping = learn_role_mapping(self._example_deck(d))
        self.assertEqual(mapping["title"], "Title Slide")
        self.assertEqual(mapping["problem"], "Title and Content")

    def test_run_learn_merges_into_existing_variant(self):
        from scripts.extract_layouts import run_setup, run_learn
        d = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, d)
        template = os.path.join(d, "t.pptx")
        Presentation().save(template)
        config = os.path.join(d, "deck-config.json")
        run_setup(template, "v1", "V1", config, os.path.join(d, "templates"))
        run_learn(self._example_deck(d), "v1", config)
        with open(config) as f:
            cfg = json.load(f)
        prefs = cfg["variants"][0]["rolePreferences"]
        self.assertEqual(prefs["title"], "Title Slide")
        self.assertEqual(prefs["problem"], "Title and Content")

    def test_run_learn_errors_when_variant_missing(self):
        from scripts.extract_layouts import run_learn
        d = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, d)
        config = os.path.join(d, "deck-config.json")
        with open(config, "w") as f:
            json.dump({"variants": []}, f)
        with self.assertRaisesRegex(ValueError, 'No variant "v1"'):
            run_learn(self._example_deck(d), "v1", config)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd deck-theme-setup && python -m unittest tests.test_extract_layouts -v`
Expected: FAIL — `ImportError` for `learn_role_mapping` / `run_learn`.

- [ ] **Step 3: Implement learning and the CLI**

Add to `deck-theme-setup/scripts/extract_layouts.py`:
```python
def learn_role_mapping(example_deck_path):
    prs = Presentation(example_deck_path)
    slides = list(prs.slides)
    total = len(slides)
    mapping = {}
    for i, slide in enumerate(slides):
        title = ""
        if slide.shapes.title is not None and slide.shapes.title.has_text_frame:
            title = slide.shapes.title.text or ""
        role = classify_slide_role(title, i, total)
        # Last slide with a given role wins — later slides override earlier ones.
        mapping[role] = slide.slide_layout.name
    return mapping


def run_learn(example_deck_path, variant_id, config_path):
    if not os.path.exists(config_path):
        raise ValueError(f'No config at "{config_path}" — run "setup" first.')
    config = _load_config(config_path)
    variant = next((v for v in config["variants"] if v.get("id") == variant_id), None)
    if variant is None:
        raise ValueError(f'No variant "{variant_id}" in {config_path} — run "setup" first.')
    mapping = learn_role_mapping(example_deck_path)
    variant["rolePreferences"] = {**variant.get("rolePreferences", {}), **mapping}
    with open(config_path, "w") as f:
        json.dump(config, f, indent=2)
    return mapping
```

Append the CLI entrypoint at the end of the file:
```python
def _main(argv=None):
    import argparse
    parser = argparse.ArgumentParser(prog="extract_layouts")
    sub = parser.add_subparsers(dest="mode", required=True)

    s = sub.add_parser("setup")
    s.add_argument("template")
    s.add_argument("variant_id")
    s.add_argument("variant_name")
    s.add_argument("config")
    s.add_argument("--templates-dir", default=None)

    l = sub.add_parser("learn")
    l.add_argument("example")
    l.add_argument("variant_id")
    l.add_argument("config")

    args = parser.parse_args(argv)
    if args.mode == "setup":
        templates_dir = args.templates_dir or os.path.join(
            os.path.dirname(os.path.abspath(args.config)), "templates"
        )
        variant = run_setup(args.template, args.variant_id, args.variant_name,
                            args.config, templates_dir)
        print(f'Saved variant "{variant["name"]}" with {len(variant["layouts"])} layouts:')
        for name in variant["layouts"]:
            print(f"  - {name}")
    elif args.mode == "learn":
        mapping = run_learn(args.example, args.variant_id, args.config)
        print(f'Learned role mappings for variant "{args.variant_id}":')
        for role, layout in mapping.items():
            print(f"  {role} -> {layout}")


if __name__ == "__main__":
    import sys
    try:
        _main()
    except Exception as exc:  # noqa: BLE001 - surface a clean message to the CLI user
        print(str(exc), file=sys.stderr)
        sys.exit(1)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd deck-theme-setup && python -m unittest tests.test_extract_layouts -v`
Expected: PASS — 12 tests total.

- [ ] **Step 5: Commit**

```bash
git add deck-theme-setup/scripts/extract_layouts.py deck-theme-setup/tests/test_extract_layouts.py
git commit -m "extract_layouts: learn role->layout from example decks, add setup/learn CLI"
```

---

## Task 6: `deck-builder` config loading and layout resolution

**Files:**
- Create: `deck-builder/scripts/build_deck.py`
- Create: `deck-builder/tests/__init__.py` (empty)
- Create: `deck-builder/tests/test_build_deck.py`

- [ ] **Step 1: Write the failing tests**

`deck-builder/tests/test_build_deck.py`:
```python
import os
import json
import shutil
import tempfile
import unittest

from pptx import Presentation
from scripts.build_deck import load_config, get_variant, resolve_layout_name


class TestConfigAndResolution(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.dir)
        self.template = os.path.join(self.dir, "templates", "v1.pptx")
        os.makedirs(os.path.dirname(self.template))
        Presentation().save(self.template)
        self.config_path = os.path.join(self.dir, "deck-config.json")
        with open(self.config_path, "w") as f:
            json.dump({"variants": [{
                "id": "v1", "name": "V1", "template": "templates/v1.pptx",
                "layouts": ["Title Slide", "Title and Content"],
                "rolePreferences": {"title": "Title Slide", "problem": "Title and Content"},
            }]}, f)

    def test_load_and_get_variant(self):
        cfg = load_config(self.config_path)
        v = get_variant(cfg, "v1")
        self.assertEqual(v["name"], "V1")

    def test_get_variant_missing_raises(self):
        cfg = load_config(self.config_path)
        with self.assertRaisesRegex(ValueError, 'No variant "nope"'):
            get_variant(cfg, "nope")

    def test_resolve_uses_role_preference(self):
        cfg = load_config(self.config_path)
        v = get_variant(cfg, "v1")
        prs = Presentation(self.template)
        name = resolve_layout_name(v, {"role": "title", "title": "Hi"}, prs)
        self.assertEqual(name, "Title Slide")

    def test_resolve_falls_back_to_body_layout_for_bullets(self):
        cfg = load_config(self.config_path)
        v = get_variant(cfg, "v1")
        v["rolePreferences"] = {}  # force fallback
        prs = Presentation(self.template)
        name = resolve_layout_name(v, {"role": "content", "bullets": ["a"]}, prs)
        # A layout that actually has a body/content placeholder.
        layout = next(l for l in prs.slide_layouts if l.name == name)
        types = {ph.placeholder_format.type for ph in layout.placeholders}
        from pptx.enum.shapes import PP_PLACEHOLDER
        self.assertTrue(PP_PLACEHOLDER.BODY in types or PP_PLACEHOLDER.OBJECT in types)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd deck-builder && python -m unittest tests.test_build_deck -v`
Expected: FAIL — `ModuleNotFoundError` / cannot import from `scripts.build_deck`.

- [ ] **Step 3: Implement config loading and resolution**

`deck-builder/scripts/build_deck.py`:
```python
"""deck-builder: render a deck by populating a real template's own layouts."""

import json
import os

from pptx import Presentation
from pptx.enum.shapes import PP_PLACEHOLDER

BODY_TYPES = (PP_PLACEHOLDER.BODY, PP_PLACEHOLDER.OBJECT)


def load_config(config_path):
    with open(config_path) as f:
        config = json.load(f)
    if not isinstance(config.get("variants"), list) or not config["variants"]:
        raise ValueError(f'Config at "{config_path}" has no variants.')
    return config


def get_variant(config, variant_id):
    for variant in config["variants"]:
        if variant.get("id") == variant_id:
            return variant
    ids = ", ".join(v.get("id", "?") for v in config["variants"])
    raise ValueError(f'No variant "{variant_id}" in config. Available: {ids}')


def _layout_has_body(layout):
    return any(ph.placeholder_format.type in BODY_TYPES for ph in layout.placeholders)


def resolve_layout_name(variant, slide, prs):
    names = [layout.name for layout in prs.slide_layouts]
    preferred = variant.get("rolePreferences", {}).get(slide.get("role"))
    if preferred and preferred in names:
        return preferred
    needs_body = bool(slide.get("bullets") or slide.get("body"))
    if needs_body:
        for layout in prs.slide_layouts:
            if _layout_has_body(layout):
                return layout.name
    return prs.slide_layouts[0].name


def _find_layout(prs, name):
    for layout in prs.slide_layouts:
        if layout.name == name:
            return layout
    return prs.slide_layouts[0]
```

Also create `deck-builder/tests/__init__.py` as an empty file.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd deck-builder && python -m unittest tests.test_build_deck -v`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add deck-builder/scripts/build_deck.py deck-builder/tests/__init__.py deck-builder/tests/test_build_deck.py
git commit -m "build_deck: load deck-config.json and resolve a slide's layout"
```

---

## Task 7: Fill placeholders by type (title / subtitle / body, with overflow auto-fit)

**Files:**
- Modify: `deck-builder/scripts/build_deck.py`
- Modify: `deck-builder/tests/test_build_deck.py`

- [ ] **Step 1: Add the failing tests**

Append to `deck-builder/tests/test_build_deck.py`:
```python
class TestFillSlide(unittest.TestCase):
    def _slide(self, layout_name):
        self.prs = Presentation()
        layout = next(l for l in self.prs.slide_layouts if l.name == layout_name)
        return self.prs.slides.add_slide(layout)

    def test_fills_title_and_subtitle(self):
        from scripts.build_deck import fill_slide
        slide = self._slide("Title Slide")
        fill_slide(slide, {"role": "title", "title": "Acme Review", "subtitle": "June 2026"})
        self.assertEqual(slide.shapes.title.text, "Acme Review")
        from pptx.enum.shapes import PP_PLACEHOLDER
        subs = [p for p in slide.placeholders
                if p.placeholder_format.type == PP_PLACEHOLDER.SUBTITLE]
        self.assertEqual(subs[0].text, "June 2026")

    def test_fills_bullets_into_body(self):
        from scripts.build_deck import fill_slide
        slide = self._slide("Title and Content")
        fill_slide(slide, {"role": "problem", "title": "Challenges",
                           "bullets": ["Alpha", "Beta", "Gamma"]})
        from pptx.enum.shapes import PP_PLACEHOLDER
        body = next(p for p in slide.placeholders
                    if p.placeholder_format.type in (PP_PLACEHOLDER.BODY, PP_PLACEHOLDER.OBJECT))
        paragraph_texts = [para.text for para in body.text_frame.paragraphs]
        self.assertEqual(paragraph_texts, ["Alpha", "Beta", "Gamma"])

    def test_bullets_must_be_a_list(self):
        from scripts.build_deck import fill_slide
        slide = self._slide("Title and Content")
        with self.assertRaisesRegex(ValueError, "isn't a list"):
            fill_slide(slide, {"role": "problem", "title": "X", "bullets": "not a list"})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd deck-builder && python -m unittest tests.test_build_deck -v`
Expected: FAIL — `ImportError` for `fill_slide`.

- [ ] **Step 3: Implement `fill_slide`**

Add to `deck-builder/scripts/build_deck.py` (add `from pptx.enum.text import MSO_AUTO_SIZE` near the top imports):
```python
from pptx.enum.text import MSO_AUTO_SIZE


def _set_text(placeholder, text=None, bullets=None):
    text_frame = placeholder.text_frame
    text_frame.word_wrap = True
    text_frame.auto_size = MSO_AUTO_SIZE.TEXT_TO_FIT_SHAPE
    if bullets:
        text_frame.text = bullets[0]
        for bullet in bullets[1:]:
            paragraph = text_frame.add_paragraph()
            paragraph.text = bullet
    else:
        text_frame.text = text or ""


def _find_placeholder(slide, types):
    for placeholder in slide.placeholders:
        if placeholder.placeholder_format.type in types:
            return placeholder
    return None


def fill_slide(slide, spec):
    label = spec.get("title") or spec.get("role") or "untitled slide"

    title = spec.get("title")
    if title and slide.shapes.title is not None:
        _set_text(slide.shapes.title, text=title)

    subtitle = spec.get("subtitle")
    if subtitle:
        placeholder = _find_placeholder(slide, (PP_PLACEHOLDER.SUBTITLE,))
        if placeholder is not None:
            _set_text(placeholder, text=subtitle)

    bullets = spec.get("bullets")
    body = spec.get("body")
    if bullets or body:
        placeholder = _find_placeholder(slide, BODY_TYPES)
        if placeholder is not None:
            if bullets is not None:
                if not isinstance(bullets, list):
                    raise ValueError(f'Slide "{label}" has a "bullets" field that isn\'t a list.')
                _set_text(placeholder, bullets=bullets)
            else:
                _set_text(placeholder, text=body)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd deck-builder && python -m unittest tests.test_build_deck -v`
Expected: PASS — 7 tests total.

- [ ] **Step 5: Commit**

```bash
git add deck-builder/scripts/build_deck.py deck-builder/tests/test_build_deck.py
git commit -m "build_deck: fill title/subtitle/body placeholders with overflow auto-fit"
```

---

## Task 8: `build_deck` end-to-end and the CLI

**Files:**
- Modify: `deck-builder/scripts/build_deck.py`
- Modify: `deck-builder/tests/test_build_deck.py`

- [ ] **Step 1: Add the failing tests**

Append to `deck-builder/tests/test_build_deck.py`:
```python
class TestBuildDeck(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.dir)
        os.makedirs(os.path.join(self.dir, "templates"))
        Presentation().save(os.path.join(self.dir, "templates", "v1.pptx"))
        self.config_path = os.path.join(self.dir, "deck-config.json")
        with open(self.config_path, "w") as f:
            json.dump({"variants": [{
                "id": "v1", "name": "V1", "template": "templates/v1.pptx",
                "layouts": ["Title Slide", "Title and Content"],
                "rolePreferences": {"title": "Title Slide", "problem": "Title and Content"},
            }]}, f)

    def test_build_produces_pptx_with_right_layouts_and_text(self):
        from scripts.build_deck import build_deck
        out = os.path.join(self.dir, "out.pptx")
        slides = [
            {"role": "title", "title": "Acme Review", "subtitle": "June 2026"},
            {"role": "problem", "title": "Current Challenges", "bullets": ["Slow", "Manual"]},
        ]
        build_deck(self.config_path, "v1", slides, out)
        self.assertTrue(os.path.exists(out))
        prs = Presentation(out)
        self.assertEqual(len(prs.slides), 2)
        self.assertEqual(prs.slides[0].slide_layout.name, "Title Slide")
        self.assertEqual(prs.slides[0].shapes.title.text, "Acme Review")
        self.assertEqual(prs.slides[1].slide_layout.name, "Title and Content")

    def test_build_starts_from_an_empty_deck(self):
        # Even if the template ships sample slides, output contains only ours.
        from scripts.build_deck import build_deck
        tmpl = os.path.join(self.dir, "templates", "v1.pptx")
        prs = Presentation(tmpl)
        prs.slides.add_slide(prs.slide_layouts[0])  # pre-existing junk slide
        prs.save(tmpl)
        out = os.path.join(self.dir, "out2.pptx")
        build_deck(self.config_path, "v1", [{"role": "title", "title": "Only Me"}], out)
        self.assertEqual(len(Presentation(out).slides), 1)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd deck-builder && python -m unittest tests.test_build_deck -v`
Expected: FAIL — `ImportError` for `build_deck`.

- [ ] **Step 3: Implement `build_deck`, slide clearing, and the CLI**

Add to `deck-builder/scripts/build_deck.py`:
```python
def _remove_all_slides(prs):
    slide_id_list = prs.slides._sldIdLst
    for slide_id in list(slide_id_list):
        slide_id_list.remove(slide_id)


def build_deck(config_path, variant_id, slides, output_path):
    if not isinstance(slides, list):
        raise ValueError(f"Expected a JSON array of slides, got {type(slides).__name__}.")
    config = load_config(config_path)
    variant = get_variant(config, variant_id)
    config_dir = os.path.dirname(os.path.abspath(config_path))
    template_path = os.path.join(config_dir, variant["template"])
    prs = Presentation(template_path)
    _remove_all_slides(prs)
    for spec in slides:
        layout_name = resolve_layout_name(variant, spec, prs)
        slide = prs.slides.add_slide(_find_layout(prs, layout_name))
        fill_slide(slide, spec)
    prs.save(output_path)
    return output_path


def _main(argv=None):
    import sys
    args = argv if argv is not None else sys.argv[1:]
    if len(args) != 4:
        print("Usage: python build_deck.py <deck-config.json> <slides.json> "
              "<variantId> <output.pptx>", file=sys.stderr)
        return 1
    config_path, slides_path, variant_id, output_path = args
    with open(slides_path) as f:
        slides = json.load(f)
    build_deck(config_path, variant_id, slides, output_path)
    print(f"Wrote {output_path}")
    return 0


if __name__ == "__main__":
    import sys
    try:
        sys.exit(_main())
    except Exception as exc:  # noqa: BLE001 - surface a clean message to the CLI user
        print(str(exc), file=sys.stderr)
        sys.exit(1)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd deck-builder && python -m unittest tests.test_build_deck -v`
Expected: PASS — 9 tests total.

- [ ] **Step 5: Commit**

```bash
git add deck-builder/scripts/build_deck.py deck-builder/tests/test_build_deck.py
git commit -m "build_deck: open the real template, add slides from its layouts, save"
```

---

## Task 9: Cross-skill seam test (real setup output → build)

**Files:**
- Create: `tests/__init__.py` (empty)
- Create: `tests/test_seam.py`

- [ ] **Step 1: Write the failing test**

Both skills expose a `scripts` package, so importing `scripts.extract_layouts` and then
`scripts.build_deck` would collide (Python binds `scripts` to whichever folder loads
first). Load each script by explicit file path under a unique module name to sidestep the
collision entirely.

`tests/test_seam.py`:
```python
import os
import json
import shutil
import tempfile
import unittest
import importlib.util

from pptx import Presentation

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _load(module_name, file_path):
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


setup_mod = _load("dts_extract_layouts",
                  os.path.join(ROOT, "deck-theme-setup", "scripts", "extract_layouts.py"))
build_mod = _load("db_build_deck",
                  os.path.join(ROOT, "deck-builder", "scripts", "build_deck.py"))


class TestSeam(unittest.TestCase):
    """Real deck-theme-setup output must feed deck-builder unchanged."""

    def _example_deck(self, dir_):
        prs = Presentation()
        layouts = {l.name: l for l in prs.slide_layouts}
        prs.slides.add_slide(layouts["Title Slide"]).shapes.title.text = "Welcome"
        prs.slides.add_slide(layouts["Title and Content"]).shapes.title.text = "Current Challenges"
        path = os.path.join(dir_, "example.pptx")
        prs.save(path)
        return path

    def test_setup_learn_then_build(self):
        d = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, d)
        template = os.path.join(d, "src.pptx")
        Presentation().save(template)
        config = os.path.join(d, "deck-config.json")

        setup_mod.run_setup(template, "v1", "V1", config, os.path.join(d, "templates"))
        setup_mod.run_learn(self._example_deck(d), "v1", config)

        out = os.path.join(d, "out.pptx")
        slides = [
            {"role": "title", "title": "Acme", "subtitle": "2026"},
            {"role": "problem", "title": "Current Challenges", "bullets": ["A", "B"]},
        ]
        build_mod.build_deck(config, "v1", slides, out)

        prs = Presentation(out)
        self.assertEqual(len(prs.slides), 2)
        self.assertEqual(prs.slides[0].slide_layout.name, "Title Slide")
        self.assertEqual(prs.slides[1].slide_layout.name, "Title and Content")
        self.assertEqual(prs.slides[0].shapes.title.text, "Acme")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the test**

Run: `cd "$(git rev-parse --show-toplevel)" && python -m unittest tests.test_seam -v`
Expected: PASS — 1 test. (This is an integration test over units already built in Tasks
4, 5, and 8, so it should pass once those are done. If it fails, the cross-skill
`deck-config.json` contract is broken — fix the offending side before continuing, do not
weaken the assertions.)

- [ ] **Step 5: Commit**

```bash
git add tests/__init__.py tests/test_seam.py
git commit -m "Add cross-skill seam test for the deck-config.json contract"
```

---

## Task 10: Rewrite both SKILL.md files for the Python flow

**Files:**
- Modify: `deck-theme-setup/SKILL.md`
- Modify: `deck-builder/SKILL.md`

- [ ] **Step 1: Replace `deck-theme-setup/SKILL.md`**

```markdown
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
```

- [ ] **Step 2: Replace `deck-builder/SKILL.md`**

```markdown
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
   - Keep bullets tight (under ~12 words) unless the persona/user wants more depth.
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
- No AI image generation. Picture placeholders in the chosen layout are left as the
  template's own native prompt; nothing is drawn into them.
- `section` and `product` may have no learned layout preference (the classifier never
  produces them); they fall back to a body-bearing layout unless set in `rolePreferences`.
```

- [ ] **Step 2: Commit**

```bash
git add deck-theme-setup/SKILL.md deck-builder/SKILL.md
git commit -m "SKILL.md: rewrite both skills for the Python python-pptx flow"
```

---

## Task 11: Root README and final verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace `README.md`**

```markdown
# Deck Theme Skills

Two [Claude Code](https://docs.anthropic.com/en/docs/claude-code) skills that generate
client presentations using your **real corporate PowerPoint template** — Claude writes the
content, and the deck is built from your template's own layouts, so logos, brand bars, and
background graphics come through intact. No web app, no third-party SaaS, no AI image
generation, and nothing leaves your machine.

## How it works

1. **`deck-theme-setup`** (once): point it at your template. It copies the file locally,
   records its layout names, and (optionally) learns from past decks which layout you use
   for which kind of slide — into `deck-config.json`.
2. **`deck-builder`** (anytime): give it a brief or paste notes. Claude drafts the slides,
   opens your real template, adds slides from its actual layouts, fills in the text, and
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

## Personas

`deck-builder` tunes tone, depth, and slide emphasis by audience: **Executive**,
**CISO**, **Technical deep-dive**, **Discovery**. Claude picks one from your brief (or you
choose) — see `deck-builder/SKILL.md`.

## Limitations

- Per-slide custom graphics that live on an individual slide (beyond its layout) are not
  reproduced — only the template's layouts and masters are. Cloning specific designed
  slides is a possible future enhancement.
- Very long content auto-shrinks to fit a placeholder; keep briefs tight for best results.

## Development

```bash
cd deck-theme-setup && pip install -r requirements.txt && python -m unittest discover tests -v
cd deck-builder     && pip install -r requirements.txt && python -m unittest discover tests -v
# from the repo root, the cross-skill seam test:
python -m unittest tests.test_seam -v
```

See `docs/superpowers/specs/2026-06-24-faithful-deck-generation-design.md` for the design.
```

- [ ] **Step 2: Run the full suite for both skills and the seam test**

```bash
cd deck-theme-setup && python -m unittest discover tests -v && cd ..
cd deck-builder && python -m unittest discover tests -v && cd ..
python -m unittest tests.test_seam -v
```
Expected: PASS — all tests in both skills (12 in deck-theme-setup, 9 in deck-builder) and the 1 seam test.

- [ ] **Step 3: Confirm no Node artifacts remain**

```bash
! find . -path ./node_modules -prune -o \( -name "*.js" -o -name "package.json" \) -print | grep -v node_modules | grep .
```
Expected: prints nothing (no leftover JavaScript or `package.json`).

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "README: document the Python python-pptx flow and update install/usage"
```

---

## Notes for the executor

- **Dependency gate:** every task after Task 1 needs `python-pptx`. If `import pptx` fails, stop and install it — do not skip the test-run steps.
- **Layout names:** tests rely on `python-pptx`'s default-template layout names ("Title Slide", "Title and Content"). These are stable across recent `python-pptx` versions. If a future version renames them, update the test fixtures, not the product code.
- **Real-template validation:** the synthetic tests use the default template. The real corporate template can only be validated on the user's company laptop — expect to tune placeholder-type matching (Task 7) and layout fallback (Task 6) against real layouts there.
