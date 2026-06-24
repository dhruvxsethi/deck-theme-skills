"use strict";

const { XMLParser } = require("fast-xml-parser");
const fs = require("fs");
const JSZip = require("jszip");
const path = require("path");

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

function colorFromNode(node) {
  if (!node) return undefined;
  if (node["a:srgbClr"]) return `#${node["a:srgbClr"]["@_val"]}`.toUpperCase();
  if (node["a:sysClr"]) return `#${node["a:sysClr"]["@_lastClr"]}`.toUpperCase();
  return undefined;
}

function parseColorScheme(xml) {
  const doc = parser.parse(xml);
  const scheme = doc["a:theme"]["a:themeElements"]["a:clrScheme"];
  return {
    dk1: colorFromNode(scheme["a:dk1"]),
    lt1: colorFromNode(scheme["a:lt1"]),
    dk2: colorFromNode(scheme["a:dk2"]),
    lt2: colorFromNode(scheme["a:lt2"]),
    accent1: colorFromNode(scheme["a:accent1"]),
    accent2: colorFromNode(scheme["a:accent2"]),
    accent3: colorFromNode(scheme["a:accent3"]),
    accent4: colorFromNode(scheme["a:accent4"]),
    accent5: colorFromNode(scheme["a:accent5"]),
    accent6: colorFromNode(scheme["a:accent6"]),
    hlink: colorFromNode(scheme["a:hlink"]),
    folHlink: colorFromNode(scheme["a:folHlink"]),
  };
}

function parseFontScheme(xml) {
  const doc = parser.parse(xml);
  const fonts = doc["a:theme"]["a:themeElements"]["a:fontScheme"];
  return {
    major: fonts["a:majorFont"]["a:latin"]["@_typeface"],
    minor: fonts["a:minorFont"]["a:latin"]["@_typeface"],
  };
}

const EMU_PER_INCH = 914400;

const PLACEHOLDER_TYPE_MAP = {
  ctrTitle: "title",
  title: "title",
  subTitle: "subTitle",
  body: "body",
  pic: "picture",
};

function normalizePlaceholderType(ph) {
  const rawType = ph && ph["@_type"];
  return PLACEHOLDER_TYPE_MAP[rawType] || "body";
}

function asArray(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function parseSlideLayoutXml(xml) {
  const doc = parser.parse(xml);
  const sldLayout = doc["p:sldLayout"];
  const name = sldLayout["p:cSld"]["@_name"];
  const shapes = asArray(sldLayout["p:cSld"]["p:spTree"]["p:sp"]);

  const placeholders = [];
  for (const sp of shapes) {
    const ph = sp["p:nvSpPr"] && sp["p:nvSpPr"]["p:nvPr"] && sp["p:nvSpPr"]["p:nvPr"]["p:ph"];
    if (!ph) continue;

    const xfrm = sp["p:spPr"] && sp["p:spPr"]["a:xfrm"];
    const off = xfrm && xfrm["a:off"];
    const ext = xfrm && xfrm["a:ext"];
    // Placeholders without their own position inherit it from the slide master in real
    // PowerPoint files. Resolving that inheritance is deferred — see design doc's noted
    // limitation; for now we skip placeholders with no explicit position.
    if (!off || !ext) continue;

    placeholders.push({
      type: normalizePlaceholderType(ph),
      x: Number(off["@_x"]) / EMU_PER_INCH,
      y: Number(off["@_y"]) / EMU_PER_INCH,
      w: Number(ext["@_cx"]) / EMU_PER_INCH,
      h: Number(ext["@_cy"]) / EMU_PER_INCH,
    });
  }

  return { name, placeholders };
}

async function extractThemeFromZipBuffer(buffer, variantId, variantName) {
  const zip = await JSZip.loadAsync(buffer);

  const themeFile = zip.file("ppt/theme/theme1.xml");
  if (!themeFile) {
    throw new Error("No ppt/theme/theme1.xml found — is this a valid .pptx/.potx file?");
  }
  const themeXml = await themeFile.async("string");
  const colors = parseColorScheme(themeXml);
  const fonts = parseFontScheme(themeXml);

  const layoutFiles = Object.keys(zip.files).filter((p) =>
    /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(p)
  );
  const layouts = [];
  for (const filePath of layoutFiles) {
    const xml = await zip.file(filePath).async("string");
    layouts.push(parseSlideLayoutXml(xml));
  }

  return { id: variantId, name: variantName, colors, fonts, layouts, rolePreferences: {} };
}

function isLikelyEncrypted(buffer) {
  return !(buffer[0] === 0x50 && buffer[1] === 0x4b);
}

async function extractTheme(filePath, variantId, variantName) {
  const buffer = fs.readFileSync(filePath);
  if (isLikelyEncrypted(buffer)) {
    throw new Error(
      `"${filePath}" doesn't look like a real .pptx/.potx file (no zip signature). ` +
        "It may have been encrypted or corrupted in transit — try re-obtaining the file."
    );
  }
  return extractThemeFromZipBuffer(buffer, variantId, variantName);
}

function runSetup(filePath, variantId, variantName, themeJsonPath) {
  return extractTheme(filePath, variantId, variantName).then((variant) => {
    let theme = { variants: [] };
    if (fs.existsSync(themeJsonPath)) {
      try {
        theme = JSON.parse(fs.readFileSync(themeJsonPath, "utf8"));
      } catch (err) {
        throw new Error(`Could not parse existing theme file at "${themeJsonPath}": ${err.message}`);
      }
    }
    if (!Array.isArray(theme.variants)) {
      throw new Error(`Theme file at "${themeJsonPath}" is missing a valid "variants" array.`);
    }
    theme.variants = theme.variants.filter((v) => v.id !== variantId);
    theme.variants.push(variant);
    fs.writeFileSync(themeJsonPath, JSON.stringify(theme, null, 2));
    console.log(`Saved variant "${variantName}" with ${variant.layouts.length} layouts to ${themeJsonPath}`);
    for (const layout of variant.layouts) {
      console.log(`  - ${layout.name} (${layout.placeholders.map((p) => p.type).join(", ")})`);
    }
  });
}

const ROLE_KEYWORDS = [
  { role: "agenda", patterns: [/agenda/i, /what we.?ll cover/i] },
  { role: "next-steps", patterns: [/next steps/i] },
  { role: "thank-you", patterns: [/thank you/i, /questions\?/i] },
  { role: "problem", patterns: [/challenge/i, /problem/i, /pain point/i, /current state/i] },
  { role: "solution", patterns: [/solution/i, /how we help/i, /our approach/i] },
  { role: "case-study", patterns: [/case study/i, /success stor/i, /customer story/i] },
  { role: "roi", patterns: [/\broi\b/i, /return on investment/i, /business case/i] },
];

function classifySlideRole(title, slideIndex, totalSlides) {
  const text = title || "";
  for (const { role, patterns } of ROLE_KEYWORDS) {
    if (patterns.some((p) => p.test(text))) return role;
  }
  if (slideIndex === 0) return "title";
  if (slideIndex === totalSlides - 1) return "thank-you";
  return "content";
}

function extractTitleFromSlideXml(xml) {
  const doc = parser.parse(xml);
  const shapes = asArray(doc["p:sld"]["p:cSld"]["p:spTree"]["p:sp"]);
  for (const sp of shapes) {
    const ph = sp["p:nvSpPr"] && sp["p:nvSpPr"]["p:nvPr"] && sp["p:nvSpPr"]["p:nvPr"]["p:ph"];
    const type = ph && ph["@_type"];
    if (type === "title" || type === "ctrTitle") {
      const paras = asArray(sp["p:txBody"] && sp["p:txBody"]["a:p"]);
      const runs = paras.flatMap((p) => asArray(p["a:r"]));
      return runs.map((r) => (r["a:t"] != null ? String(r["a:t"]) : "")).join("");
    }
  }
  return "";
}

function resolveRelPath(basePath, target) {
  return path.posix.normalize(path.posix.join(basePath, target));
}

async function findSlideLayoutName(zip, slideNumber) {
  const relsPath = `ppt/slides/_rels/slide${slideNumber}.xml.rels`;
  const relsFile = zip.file(relsPath);
  if (!relsFile) return undefined;
  const relsXml = await relsFile.async("string");
  const relsDoc = parser.parse(relsXml);
  const rels = asArray(relsDoc.Relationships.Relationship);
  const layoutRel = rels.find((r) => /\/slideLayout$/.test(r["@_Type"]));
  if (!layoutRel) return undefined;

  const layoutPath = resolveRelPath("ppt/slides", layoutRel["@_Target"]);
  const layoutFile = zip.file(layoutPath);
  if (!layoutFile) return undefined;
  const layoutXml = await layoutFile.async("string");
  return parseSlideLayoutXml(layoutXml).name;
}

async function learnRoleMappingFromExampleDeck(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => Number(a.match(/slide(\d+)\.xml/)[1]) - Number(b.match(/slide(\d+)\.xml/)[1]));

  const rolePreferences = {};
  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.file(slideFiles[i]).async("string");
    const title = extractTitleFromSlideXml(xml);
    const role = classifySlideRole(title, i, slideFiles.length);
    const layoutName = await findSlideLayoutName(zip, i + 1);
    // Last slide with a given role wins — later slides override earlier ones for the same role.
    if (layoutName) rolePreferences[role] = layoutName;
  }
  return rolePreferences;
}

module.exports = {
  parseColorScheme,
  parseFontScheme,
  parseSlideLayoutXml,
  asArray,
  extractThemeFromZipBuffer,
  extractTheme,
  isLikelyEncrypted,
  runSetup,
  classifySlideRole,
  learnRoleMappingFromExampleDeck,
  runLearn,
};

function runLearn(filePath, variantId, themeJsonPath) {
  const buffer = fs.readFileSync(filePath);
  if (isLikelyEncrypted(buffer)) {
    return Promise.reject(new Error(`"${filePath}" doesn't look like a real .pptx file.`));
  }
  return learnRoleMappingFromExampleDeck(buffer).then((rolePreferences) => {
    if (!fs.existsSync(themeJsonPath)) {
      throw new Error(`No theme.json found at "${themeJsonPath}" — run "setup" first.`);
    }
    let theme;
    try {
      theme = JSON.parse(fs.readFileSync(themeJsonPath, "utf8"));
    } catch (err) {
      throw new Error(`Could not parse existing theme file at "${themeJsonPath}": ${err.message}`);
    }
    if (!Array.isArray(theme.variants)) {
      throw new Error(`Theme file at "${themeJsonPath}" is missing a valid "variants" array.`);
    }
    const variant = theme.variants.find((v) => v.id === variantId);
    if (!variant) {
      throw new Error(`No variant "${variantId}" in ${themeJsonPath} — run "setup" first.`);
    }
    variant.rolePreferences = { ...variant.rolePreferences, ...rolePreferences };
    fs.writeFileSync(themeJsonPath, JSON.stringify(theme, null, 2));
    console.log(`Learned role mappings for variant "${variantId}":`);
    for (const [role, layoutName] of Object.entries(rolePreferences)) {
      console.log(`  ${role} -> ${layoutName}`);
    }
  });
}

if (require.main === module) {
  const [mode, ...rest] = process.argv.slice(2);
  if (mode === "setup") {
    const [filePath, variantId, variantName, themeJsonPath] = rest;
    if (!filePath || !variantId || !variantName || !themeJsonPath) {
      console.error("Usage: node extract-theme.js setup <theme-file.pptx> <variantId> <variantName> <theme.json>");
      process.exit(1);
    }
    runSetup(filePath, variantId, variantName, themeJsonPath).catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
  } else if (mode === "learn") {
    const [filePath, variantId, themeJsonPath] = rest;
    if (!filePath || !variantId || !themeJsonPath) {
      console.error("Usage: node extract-theme.js learn <example-deck.pptx> <variantId> <theme.json>");
      process.exit(1);
    }
    runLearn(filePath, variantId, themeJsonPath).catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
  } else {
    console.error("Usage: node extract-theme.js <setup|learn> ...");
    process.exit(1);
  }
}
