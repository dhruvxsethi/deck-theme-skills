const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const JSZip = require("jszip");
const {
  loadTheme,
  getVariant,
  resolveLayoutForSlide,
  buildPresentation,
  writePresentation,
} = require("./generate-pptx");

const CLI_PATH = path.join(__dirname, "generate-pptx.js");

function writeTempTheme(theme) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deck-theme-"));
  const file = path.join(dir, "theme.json");
  fs.writeFileSync(file, JSON.stringify(theme));
  return file;
}

test("loadTheme reads variants from a theme.json file", () => {
  const file = writeTempTheme({ variants: [{ id: "v1", name: "Variant One" }] });
  const theme = loadTheme(file);
  assert.equal(theme.variants.length, 1);
  assert.equal(theme.variants[0].id, "v1");
});

test("loadTheme throws when there are no variants", () => {
  const file = writeTempTheme({ variants: [] });
  assert.throws(() => loadTheme(file), /no variants/);
});

test("getVariant finds a variant by id", () => {
  const theme = { variants: [{ id: "a", name: "A" }, { id: "b", name: "B" }] };
  assert.equal(getVariant(theme, "b").name, "B");
});

test("getVariant throws with available ids when not found", () => {
  const theme = { variants: [{ id: "a", name: "A" }] };
  assert.throws(() => getVariant(theme, "missing"), /Available: a/);
});

const sampleVariant = {
  id: "v1",
  layouts: [
    { name: "Title Slide", placeholders: [{ type: "title", x: 0.5, y: 2, w: 8, h: 1 }] },
    {
      name: "Two Content",
      placeholders: [
        { type: "title", x: 0.4, y: 0.3, w: 8.7, h: 0.8 },
        { type: "body", x: 0.5, y: 1.4, w: 8.5, h: 3.5 },
      ],
    },
  ],
  rolePreferences: { title: "Title Slide", problem: "Two Content" },
};

test("resolveLayoutForSlide uses the role preference when available", () => {
  const layout = resolveLayoutForSlide(sampleVariant, { role: "problem", bullets: ["a"] });
  assert.equal(layout, "Two Content");
});

test("resolveLayoutForSlide falls back to a body layout for unknown roles with bullets", () => {
  const layout = resolveLayoutForSlide(sampleVariant, { role: "roi", bullets: ["a", "b"] });
  assert.equal(layout, "Two Content");
});

test("resolveLayoutForSlide falls back to a title-only layout when there's no body content", () => {
  const layout = resolveLayoutForSlide(sampleVariant, { role: "thank-you" });
  assert.equal(layout, "Title Slide");
});

const fixtureTheme = {
  variants: [
    {
      id: "test-variant",
      name: "Test Variant",
      colors: { accent1: "#FA582D", dk1: "#111111", dk2: "#888888", lt1: "#FFFFFF" },
      layouts: [
        { name: "Title Slide", placeholders: [{ type: "title", x: 0.5, y: 2, w: 8, h: 1 }] },
        {
          name: "Two Content",
          placeholders: [
            { type: "title", x: 0.4, y: 0.3, w: 8.7, h: 0.8 },
            { type: "body", x: 0.5, y: 1.4, w: 8.5, h: 3.5 },
          ],
        },
      ],
      rolePreferences: { title: "Title Slide", problem: "Two Content" },
    },
  ],
};

test("writePresentation produces a pptx containing slide title and theme color", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deck-out-"));
  const outputPath = path.join(dir, "deck.pptx");

  await writePresentation(
    fixtureTheme,
    "test-variant",
    [
      { role: "title", title: "Acme Corp Kickoff" },
      { role: "problem", title: "The Problem", bullets: ["Too many tools", "Slow response"] },
    ],
    outputPath
  );

  const buffer = fs.readFileSync(outputPath);
  const zip = await JSZip.loadAsync(buffer);
  const slide1 = await zip.file("ppt/slides/slide1.xml").async("string");
  const slide2 = await zip.file("ppt/slides/slide2.xml").async("string");

  assert.match(slide1, /Acme Corp Kickoff/);
  assert.match(slide1, /FA582D/i);
  assert.match(slide2, /Too many tools/);
  assert.match(slide2, /Slow response/);
});

test("buildPresentation throws a clear error when required theme colors are missing", () => {
  const incompleteTheme = {
    variants: [
      {
        id: "broken",
        colors: { accent1: "#FA582D" }, // missing dk1, dk2, lt1
        layouts: [{ name: "Title Slide", placeholders: [{ type: "title", x: 0.5, y: 2, w: 8, h: 1 }] }],
        rolePreferences: {},
      },
    ],
  };
  assert.throws(
    () => buildPresentation(incompleteTheme, "broken", [{ role: "title", title: "Test" }]),
    /missing required theme colors: dk1, dk2, lt1/
  );
});

test("writePresentation fills the subtitle placeholder when the layout has one and the slide provides text", async () => {
  const themeWithSubtitle = {
    variants: [
      {
        id: "test-variant",
        colors: { accent1: "#FA582D", dk1: "#111111", dk2: "#888888", lt1: "#FFFFFF" },
        layouts: [
          {
            name: "Title Slide",
            placeholders: [
              { type: "title", x: 0.5, y: 2, w: 8, h: 1 },
              { type: "subTitle", x: 0.5, y: 3.2, w: 8, h: 0.6 },
            ],
          },
        ],
        rolePreferences: { title: "Title Slide" },
      },
    ],
  };

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deck-out-"));
  const outputPath = path.join(dir, "deck.pptx");

  await writePresentation(
    themeWithSubtitle,
    "test-variant",
    [{ role: "title", title: "Acme Corp", subtitle: "A New Beginning" }],
    outputPath
  );

  const buffer = fs.readFileSync(outputPath);
  const zip = await JSZip.loadAsync(buffer);
  const slide1 = await zip.file("ppt/slides/slide1.xml").async("string");

  assert.match(slide1, /A New Beginning/);
  assert.match(slide1, /888888/i);
});

test("writePresentation draws an image placeholder box when the layout has a picture slot", async () => {
  const themeWithPicture = {
    variants: [
      {
        id: "test-variant",
        colors: { accent1: "#FA582D", dk1: "#111111", dk2: "#888888", lt1: "#FFFFFF" },
        layouts: [
          {
            name: "Image Right",
            placeholders: [
              { type: "title", x: 0.4, y: 0.3, w: 8.7, h: 0.8 },
              { type: "body", x: 0.5, y: 1.4, w: 4, h: 3.5 },
              { type: "picture", x: 5, y: 1.4, w: 4, h: 3.5 },
            ],
          },
        ],
        rolePreferences: { solution: "Image Right" },
      },
    ],
  };

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deck-out-"));
  const outputPath = path.join(dir, "deck.pptx");

  await writePresentation(
    themeWithPicture,
    "test-variant",
    [{ role: "solution", title: "Our Approach", bullets: ["Point one"], imageCount: 1 }],
    outputPath
  );

  const buffer = fs.readFileSync(outputPath);
  const zip = await JSZip.loadAsync(buffer);
  const slide1 = await zip.file("ppt/slides/slide1.xml").async("string");

  assert.match(slide1, /Image placeholder/);
  assert.match(slide1, /dash/i);
});

test("the CLI reports a clear error when slides.json isn't an array", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deck-cli-"));
  const themePath = path.join(dir, "theme.json");
  const slidesPath = path.join(dir, "slides.json");
  const outputPath = path.join(dir, "deck.pptx");

  fs.writeFileSync(themePath, JSON.stringify(fixtureTheme));
  fs.writeFileSync(slidesPath, JSON.stringify({ role: "title", title: "Not An Array" }));

  assert.throws(
    () =>
      execFileSync("node", [CLI_PATH, themePath, slidesPath, "test-variant", outputPath], {
        stdio: "pipe",
      }),
    (err) => {
      assert.match(err.stderr.toString(), /Expected .* to contain a JSON array of slides, got object/);
      return true;
    }
  );
});

test("buildPresentation throws a clear error when a slide's bullets field isn't an array", () => {
  const theme = {
    variants: [
      {
        id: "test-variant",
        colors: { accent1: "#FA582D", dk1: "#111111", dk2: "#888888", lt1: "#FFFFFF" },
        layouts: [
          {
            name: "Two Content",
            placeholders: [
              { type: "title", x: 0.4, y: 0.3, w: 8.7, h: 0.8 },
              { type: "body", x: 0.5, y: 1.4, w: 8.5, h: 3.5 },
            ],
          },
        ],
        rolePreferences: { problem: "Two Content" },
      },
    ],
  };
  assert.throws(
    () => buildPresentation(theme, "test-variant", [{ role: "problem", title: "Bad Slide", bullets: "not an array" }]),
    /bullets" field that isn't an array/
  );
});
