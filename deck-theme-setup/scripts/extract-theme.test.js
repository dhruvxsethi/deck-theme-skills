const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const JSZip = require("jszip");
const {
  parseColorScheme,
  parseFontScheme,
  parseSlideLayoutXml,
  extractThemeFromZipBuffer,
  extractTheme,
  isLikelyEncrypted,
  runSetup,
  classifySlideRole,
  learnRoleMappingFromExampleDeck,
  runLearn,
} = require("./extract-theme");

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

test("parseColorScheme reads srgbClr and sysClr values", () => {
  const colors = parseColorScheme(THEME_XML);
  assert.equal(colors.dk1, "#000000");
  assert.equal(colors.lt1, "#FFFFFF");
  assert.equal(colors.accent1, "#FA582D");
  assert.equal(colors.hlink, "#0563C1");
});

test("parseFontScheme reads major/minor latin typefaces", () => {
  const fonts = parseFontScheme(THEME_XML);
  assert.equal(fonts.major, "Arial");
  assert.equal(fonts.minor, "Arial");
});

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

test("parseSlideLayoutXml reads the layout name and placeholder positions in inches", () => {
  const layout = parseSlideLayoutXml(LAYOUT_XML);
  assert.equal(layout.name, "Title Slide");
  assert.equal(layout.placeholders.length, 2);
  const title = layout.placeholders.find((p) => p.type === "title");
  assert.ok(title);
  assert.ok(Math.abs(title.x - 0.75) < 0.01);
  assert.ok(Math.abs(title.y - 2.33) < 0.01);
  const subtitle = layout.placeholders.find((p) => p.type === "subTitle");
  assert.ok(subtitle);
});

test("parseSlideLayoutXml skips placeholders with no position info instead of crashing", () => {
  const xmlNoXfrm = `<?xml version="1.0"?>
<p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
             xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld name="No Position">
    <p:spTree>
      <p:sp><p:nvSpPr><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp>
    </p:spTree>
  </p:cSld>
</p:sldLayout>`;
  const layout = parseSlideLayoutXml(xmlNoXfrm);
  assert.equal(layout.placeholders.length, 0);
});

async function buildFixtureZipBuffer() {
  const zip = new JSZip();
  zip.file("ppt/theme/theme1.xml", THEME_XML);
  zip.file("ppt/slideLayouts/slideLayout1.xml", LAYOUT_XML);
  zip.file(
    "ppt/slideLayouts/slideLayout2.xml",
    LAYOUT_XML.replace('name="Title Slide"', 'name="Two Content"')
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

test("extractThemeFromZipBuffer returns colors, fonts, and every layout found", async () => {
  const buffer = await buildFixtureZipBuffer();
  const variant = await extractThemeFromZipBuffer(buffer, "v1", "Variant One");
  assert.equal(variant.id, "v1");
  assert.equal(variant.colors.accent1, "#FA582D");
  assert.equal(variant.fonts.major, "Arial");
  assert.equal(variant.layouts.length, 2);
  assert.deepEqual(variant.layouts.map((l) => l.name).sort(), ["Title Slide", "Two Content"]);
});

test("extractThemeFromZipBuffer throws a clear error when theme1.xml is missing", async () => {
  const emptyZipBuffer = await new JSZip().generateAsync({ type: "nodebuffer" });
  await assert.rejects(
    () => extractThemeFromZipBuffer(emptyZipBuffer, "v1", "Variant One"),
    /No ppt\/theme\/theme1\.xml/
  );
});

test("isLikelyEncrypted detects a missing zip signature", () => {
  assert.equal(isLikelyEncrypted(Buffer.from([0xe5, 0xe4, 0x88, 0xdb])), true);
  assert.equal(isLikelyEncrypted(Buffer.from([0x50, 0x4b, 0x03, 0x04])), false);
});

test("extractTheme reads a real file from disk and throws clearly for non-pptx files", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deck-fixture-"));
  const goodPath = path.join(dir, "theme.pptx");
  fs.writeFileSync(goodPath, await buildFixtureZipBuffer());
  const variant = await extractTheme(goodPath, "v1", "Variant One");
  assert.equal(variant.layouts.length, 2);

  const badPath = path.join(dir, "encrypted.pptx");
  fs.writeFileSync(badPath, Buffer.from([0xe5, 0xe4, 0x88, 0xdb, 0x86, 0x64]));
  await assert.rejects(() => extractTheme(badPath, "v1", "Variant One"), /doesn't look like a real/);
});

test("runSetup throws a clear error mentioning the file path when theme.json is malformed", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deck-fixture-"));
  const pptxPath = path.join(dir, "theme.pptx");
  fs.writeFileSync(pptxPath, await buildFixtureZipBuffer());

  const themeJsonPath = path.join(dir, "theme.json");
  fs.writeFileSync(themeJsonPath, "{ not valid json");

  await assert.rejects(
    () => runSetup(pptxPath, "v1", "Variant One", themeJsonPath),
    (err) => {
      assert.match(err.message, /Could not parse existing theme file/);
      assert.ok(err.message.includes(themeJsonPath), "error should mention the file path");
      return true;
    }
  );
});

test("runSetup throws a clear error mentioning the file path when theme.json has a non-array variants", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deck-fixture-"));
  const pptxPath = path.join(dir, "theme.pptx");
  fs.writeFileSync(pptxPath, await buildFixtureZipBuffer());

  const themeJsonPath = path.join(dir, "theme.json");
  fs.writeFileSync(themeJsonPath, JSON.stringify({ variants: { not: "an array" } }));

  await assert.rejects(
    () => runSetup(pptxPath, "v1", "Variant One", themeJsonPath),
    (err) => {
      assert.match(err.message, /missing a valid "variants" array/);
      assert.ok(err.message.includes(themeJsonPath), "error should mention the file path");
      return true;
    }
  );
});

test("classifySlideRole matches common keywords", () => {
  assert.equal(classifySlideRole("Agenda", 1, 8), "agenda");
  assert.equal(classifySlideRole("Thank You", 7, 8), "thank-you");
  assert.equal(classifySlideRole("Next Steps", 6, 8), "next-steps");
  assert.equal(classifySlideRole("Current Challenges", 2, 8), "problem");
  assert.equal(classifySlideRole("Our Solution", 3, 8), "solution");
  assert.equal(classifySlideRole("Customer Success Story", 4, 8), "case-study");
  assert.equal(classifySlideRole("Return on Investment", 5, 8), "roi");
});

test("classifySlideRole falls back to position for the first and last slide", () => {
  assert.equal(classifySlideRole("Welcome", 0, 8), "title");
  assert.equal(classifySlideRole("Goodbye", 7, 8), "thank-you");
});

test("classifySlideRole falls back to content for anything else", () => {
  assert.equal(classifySlideRole("Our Platform Overview", 3, 8), "content");
});

function buildExampleSlideXml(titleText) {
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

function buildRelsXml(layoutFileName) {
  return `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout"
    Target="../slideLayouts/${layoutFileName}"/>
</Relationships>`;
}

async function buildExampleDeckZipBuffer() {
  const zip = new JSZip();
  zip.file("ppt/slideLayouts/slideLayout1.xml", LAYOUT_XML);
  zip.file(
    "ppt/slideLayouts/slideLayout2.xml",
    LAYOUT_XML.replace('name="Title Slide"', 'name="Two Content"')
  );
  zip.file("ppt/slides/slide1.xml", buildExampleSlideXml("Welcome to Acme"));
  zip.file("ppt/slides/_rels/slide1.xml.rels", buildRelsXml("slideLayout1.xml"));
  zip.file("ppt/slides/slide2.xml", buildExampleSlideXml("Current Challenges"));
  zip.file("ppt/slides/_rels/slide2.xml.rels", buildRelsXml("slideLayout2.xml"));
  zip.file("ppt/slides/slide3.xml", buildExampleSlideXml("Thank You"));
  zip.file("ppt/slides/_rels/slide3.xml.rels", buildRelsXml("slideLayout1.xml"));
  return zip.generateAsync({ type: "nodebuffer" });
}

test("learnRoleMappingFromExampleDeck maps each slide's role to the layout it actually used", async () => {
  const buffer = await buildExampleDeckZipBuffer();
  const mapping = await learnRoleMappingFromExampleDeck(buffer);
  assert.equal(mapping.title, "Title Slide");
  assert.equal(mapping.problem, "Two Content");
  assert.equal(mapping["thank-you"], "Title Slide");
});

async function buildSameRoleTwiceDeckZipBuffer() {
  // Two slides that both classify to the fallback "content" role (middle slides with
  // titles that don't match any keyword pattern), but using different layouts. Used to
  // verify "last slide wins" rather than "first slide wins".
  const zip = new JSZip();
  zip.file("ppt/slideLayouts/slideLayout1.xml", LAYOUT_XML);
  zip.file(
    "ppt/slideLayouts/slideLayout2.xml",
    LAYOUT_XML.replace('name="Title Slide"', 'name="Two Content"')
  );
  zip.file("ppt/slides/slide1.xml", buildExampleSlideXml("Welcome to Acme"));
  zip.file("ppt/slides/_rels/slide1.xml.rels", buildRelsXml("slideLayout1.xml"));
  zip.file("ppt/slides/slide2.xml", buildExampleSlideXml("Our Platform Overview"));
  zip.file("ppt/slides/_rels/slide2.xml.rels", buildRelsXml("slideLayout1.xml"));
  zip.file("ppt/slides/slide3.xml", buildExampleSlideXml("Why It Matters"));
  zip.file("ppt/slides/_rels/slide3.xml.rels", buildRelsXml("slideLayout2.xml"));
  zip.file("ppt/slides/slide4.xml", buildExampleSlideXml("Thank You"));
  zip.file("ppt/slides/_rels/slide4.xml.rels", buildRelsXml("slideLayout1.xml"));
  return zip.generateAsync({ type: "nodebuffer" });
}

test("learnRoleMappingFromExampleDeck keeps the last slide's layout when two slides share a role", async () => {
  const buffer = await buildSameRoleTwiceDeckZipBuffer();
  const mapping = await learnRoleMappingFromExampleDeck(buffer);
  // Slide 2 ("Our Platform Overview") and slide 3 ("Why It Matters") both fall back to
  // the "content" role. Slide 2 uses slideLayout1 ("Title Slide"), slide 3 uses
  // slideLayout2 ("Two Content"). The learned mapping should reflect slide 3 (the later
  // one), not slide 2 — this fails if "last wins" regresses to "first wins".
  assert.equal(mapping.content, "Two Content");
});

test("runLearn throws a clear error mentioning the file path when theme.json is missing", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deck-fixture-"));
  const pptxPath = path.join(dir, "example-deck.pptx");
  fs.writeFileSync(pptxPath, await buildExampleDeckZipBuffer());

  const themeJsonPath = path.join(dir, "theme.json");

  await assert.rejects(
    () => runLearn(pptxPath, "v1", themeJsonPath),
    (err) => {
      assert.match(err.message, /No theme\.json found/);
      assert.ok(err.message.includes(themeJsonPath), "error should mention the file path");
      return true;
    }
  );
});

test("runLearn throws a clear error mentioning the file path when theme.json is malformed", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deck-fixture-"));
  const pptxPath = path.join(dir, "example-deck.pptx");
  fs.writeFileSync(pptxPath, await buildExampleDeckZipBuffer());

  const themeJsonPath = path.join(dir, "theme.json");
  fs.writeFileSync(themeJsonPath, "{ not valid json");

  await assert.rejects(
    () => runLearn(pptxPath, "v1", themeJsonPath),
    (err) => {
      assert.match(err.message, /Could not parse existing theme file/);
      assert.ok(err.message.includes(themeJsonPath), "error should mention the file path");
      return true;
    }
  );
});

test("runLearn throws a clear error mentioning the file path when theme.json has a non-array variants", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "deck-fixture-"));
  const pptxPath = path.join(dir, "example-deck.pptx");
  fs.writeFileSync(pptxPath, await buildExampleDeckZipBuffer());

  const themeJsonPath = path.join(dir, "theme.json");
  fs.writeFileSync(themeJsonPath, JSON.stringify({ variants: { not: "an array" } }));

  await assert.rejects(
    () => runLearn(pptxPath, "v1", themeJsonPath),
    (err) => {
      assert.match(err.message, /missing a valid "variants" array/);
      assert.ok(err.message.includes(themeJsonPath), "error should mention the file path");
      return true;
    }
  );
});
