// Cross-skill seam test (dev-only; NOT shipped inside either skill folder).
//
// The two skills are designed to be copied to ~/.claude/skills/ independently, so this
// test deliberately lives at the repo root rather than inside deck-theme-setup/ or
// deck-builder/ — it couples the two on purpose to guard the one contract that neither
// skill's own suite can: the `theme.json` shape that extract-theme.js WRITES must be
// exactly what generate-pptx.js READS. Each per-skill suite tests against a hand-authored
// mock of the other's output, so a future rename (e.g. subTitle -> subtitle, or an
// EMU/inches change) would pass both suites while silently breaking the pipeline. This
// test runs the real extractor output through the real generator end to end.
//
// Run from the repo root with: node --test "tests/**/*.test.js"
// (Requires `npm install` to have been run in both skill folders.)

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const THEME_SETUP_DIR = path.join(__dirname, "..", "deck-theme-setup");
const DECK_DIR = path.join(__dirname, "..", "deck-builder");

// jszip is a dependency of deck-theme-setup; resolve it from there rather than assuming a
// root node_modules exists.
const JSZip = require(require.resolve("jszip", {
  paths: [path.join(THEME_SETUP_DIR, "node_modules")],
}));

const { extractThemeFromZipBuffer, learnRoleMappingFromExampleDeck } = require(path.join(
  THEME_SETUP_DIR,
  "scripts",
  "extract-theme.js"
));
const { loadTheme, getVariant, resolveLayoutForSlide, writePresentation } = require(path.join(
  DECK_DIR,
  "scripts",
  "generate-pptx.js"
));

const THEME_XML = `<?xml version="1.0"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="MyTheme">
  <a:themeElements>
    <a:clrScheme name="MyColors">
      <a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>
      <a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="1A1A1A"/></a:dk2>
      <a:lt2><a:srgbClr val="F2F2F2"/></a:lt2>
      <a:accent1><a:srgbClr val="FA582D"/></a:accent1>
      <a:accent2><a:srgbClr val="0072CE"/></a:accent2>
      <a:accent3><a:srgbClr val="00A19A"/></a:accent3>
      <a:accent4><a:srgbClr val="FFB81C"/></a:accent4>
      <a:accent5><a:srgbClr val="7F3F98"/></a:accent5>
      <a:accent6><a:srgbClr val="84BD00"/></a:accent6>
      <a:hlink><a:srgbClr val="0563C1"/></a:hlink>
      <a:folHlink><a:srgbClr val="954F72"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="MyFonts">
      <a:majorFont><a:latin typeface="Arial"/></a:majorFont>
      <a:minorFont><a:latin typeface="Arial"/></a:minorFont>
    </a:fontScheme>
  </a:themeElements>
</a:theme>`;

const LAYOUT_XML = `<?xml version="1.0"?>
<p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
             xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld name="Title Slide">
    <p:spTree>
      <p:sp>
        <p:nvSpPr><p:nvPr><p:ph type="ctrTitle"/></p:nvPr></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="685800" y="2130425"/><a:ext cx="7600950" cy="1145540"/></a:xfrm></p:spPr>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:nvPr><p:ph type="subTitle" idx="1"/></p:nvPr></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="685800" y="3505200"/><a:ext cx="7600950" cy="800000"/></a:xfrm></p:spPr>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sldLayout>`;

function exampleSlideXml(titleText) {
  return `<?xml version="1.0"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
        <p:txBody><a:p><a:r><a:t>${titleText}</a:t></a:r></a:p></p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;
}

function relsXml(layoutFileName) {
  return `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout"
    Target="../slideLayouts/${layoutFileName}"/>
</Relationships>`;
}

function themeZipBuffer() {
  const zip = new JSZip();
  zip.file("ppt/theme/theme1.xml", THEME_XML);
  zip.file("ppt/slideLayouts/slideLayout1.xml", LAYOUT_XML);
  zip.file(
    "ppt/slideLayouts/slideLayout2.xml",
    LAYOUT_XML.replace('name="Title Slide"', 'name="Two Content"')
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

function exampleDeckZipBuffer() {
  const zip = new JSZip();
  zip.file("ppt/slideLayouts/slideLayout1.xml", LAYOUT_XML);
  zip.file(
    "ppt/slideLayouts/slideLayout2.xml",
    LAYOUT_XML.replace('name="Title Slide"', 'name="Two Content"')
  );
  zip.file("ppt/slides/slide1.xml", exampleSlideXml("Welcome to Acme"));
  zip.file("ppt/slides/_rels/slide1.xml.rels", relsXml("slideLayout1.xml"));
  zip.file("ppt/slides/slide2.xml", exampleSlideXml("Current Challenges"));
  zip.file("ppt/slides/_rels/slide2.xml.rels", relsXml("slideLayout2.xml"));
  return zip.generateAsync({ type: "nodebuffer" });
}

test("real extract-theme output flows through generate-pptx end to end", async () => {
  // 1. Extract a variant from a theme file exactly as `setup` mode does.
  const variant = await extractThemeFromZipBuffer(await themeZipBuffer(), "v1", "Variant One");

  // 2. Learn role -> layout preferences from an example deck exactly as `learn` mode does,
  //    and merge them in the same way runLearn would.
  const learned = await learnRoleMappingFromExampleDeck(await exampleDeckZipBuffer());
  variant.rolePreferences = { ...variant.rolePreferences, ...learned };
  assert.equal(variant.rolePreferences.title, "Title Slide");
  assert.equal(variant.rolePreferences.problem, "Two Content");

  // 3. Persist as theme.json and read it back through the generator's own loader — this is
  //    the exact on-disk contract between the two skills.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deck-seam-"));
  const themeJsonPath = path.join(dir, "theme.json");
  fs.writeFileSync(themeJsonPath, JSON.stringify({ variants: [variant] }, null, 2));

  const theme = loadTheme(themeJsonPath);
  const loadedVariant = getVariant(theme, "v1");

  // 4. The generator resolves the same layouts the extractor produced.
  assert.equal(resolveLayoutForSlide(loadedVariant, { role: "title", title: "Hi" }), "Title Slide");
  assert.equal(
    resolveLayoutForSlide(loadedVariant, { role: "problem", title: "X", bullets: ["a"] }),
    "Two Content"
  );

  // 5. Build a real .pptx from the real extracted variant and confirm it opens as a zip
  //    containing the slide title text.
  const outPath = path.join(dir, "deck.pptx");
  const slides = [
    { role: "title", title: "Acme Security Review", subtitle: "Q2 2026" },
    { role: "problem", title: "Current Gaps", bullets: ["Slow detection", "Manual triage"] },
  ];
  await writePresentation(theme, "v1", slides, outPath);

  assert.ok(fs.existsSync(outPath), "expected the .pptx file to be written");
  const outZip = await JSZip.loadAsync(fs.readFileSync(outPath));
  const slide1 = await outZip.file("ppt/slides/slide1.xml").async("string");
  assert.match(slide1, /Acme Security Review/);
});
