"use strict";

const fs = require("fs");
const pptxgen = require("pptxgenjs");

function loadTheme(themeJsonPath) {
  const raw = fs.readFileSync(themeJsonPath, "utf8");
  const theme = JSON.parse(raw);
  if (!Array.isArray(theme.variants) || theme.variants.length === 0) {
    throw new Error(`theme.json at ${themeJsonPath} has no variants.`);
  }
  return theme;
}

function getVariant(theme, variantId) {
  const variant = theme.variants.find((v) => v.id === variantId);
  if (!variant) {
    const available = theme.variants.map((v) => v.id).join(", ");
    throw new Error(`No variant "${variantId}" in theme.json. Available: ${available}`);
  }
  return variant;
}

function layoutHasPlaceholderType(layout, type) {
  return layout.placeholders.some((p) => p.type === type);
}

function resolveLayoutForSlide(variant, slideSpec) {
  const preferred = variant.rolePreferences && variant.rolePreferences[slideSpec.role];
  if (preferred && variant.layouts.some((l) => l.name === preferred)) {
    return preferred;
  }

  const wantsBody = Boolean((slideSpec.bullets && slideSpec.bullets.length > 0) || slideSpec.body);
  if (wantsBody) {
    const withBody = variant.layouts.find((l) => layoutHasPlaceholderType(l, "body"));
    if (withBody) return withBody.name;
  } else {
    const titleOnly = variant.layouts.find(
      (l) => layoutHasPlaceholderType(l, "title") && !layoutHasPlaceholderType(l, "body")
    );
    if (titleOnly) return titleOnly.name;
  }

  if (variant.layouts.length === 0) {
    throw new Error(`Variant "${variant.id}" has no layouts.`);
  }
  return variant.layouts[0].name;
}

function hexNoHash(hex) {
  return (hex || "000000").replace("#", "").toUpperCase();
}

const REQUIRED_COLOR_KEYS = ["accent1", "dk1", "dk2", "lt1"];

function buildPresentation(theme, variantId, slides) {
  const variant = getVariant(theme, variantId);
  const missingColors = REQUIRED_COLOR_KEYS.filter((key) => !variant.colors || !variant.colors[key]);
  if (missingColors.length > 0) {
    throw new Error(
      `Variant "${variant.id}" is missing required theme colors: ${missingColors.join(", ")}.`
    );
  }
  const pptx = new pptxgen();
  pptx.defineLayout({ name: "DECK", width: 10, height: 5.63 });
  pptx.layout = "DECK";

  const layoutNamesUsed = [...new Set(slides.map((s) => resolveLayoutForSlide(variant, s)))];
  const masters = {};
  for (const name of layoutNamesUsed) {
    const layout = variant.layouts.find((l) => l.name === name);
    if (!layout) throw new Error(`Layout "${name}" not found in variant "${variant.id}".`);
    masters[name] = layout;
  }

  for (const [name, layout] of Object.entries(masters)) {
    const masterPlaceholders = layout.placeholders.filter((ph) => ph.type !== "picture");
    pptx.defineSlideMaster({
      title: name,
      background: { color: hexNoHash(variant.colors.lt1 || "#FFFFFF") },
      objects: masterPlaceholders.map((ph) => ({
        placeholder: {
          options: {
            name: ph.type,
            type: ph.type === "title" || ph.type === "subTitle" ? "title" : "body",
            x: ph.x,
            y: ph.y,
            w: ph.w,
            h: ph.h,
          },
          text: "",
        },
      })),
    });
  }

  for (const slideSpec of slides) {
    if (slideSpec.bullets !== undefined && !Array.isArray(slideSpec.bullets)) {
      throw new Error(
        `Slide "${slideSpec.title || slideSpec.role}" has a "bullets" field that isn't an array.`
      );
    }
    const layoutName = resolveLayoutForSlide(variant, slideSpec);
    const layout = masters[layoutName];
    const slide = pptx.addSlide({ masterName: layoutName });

    const titlePh = layout.placeholders.find((p) => p.type === "title");
    if (titlePh && slideSpec.title) {
      slide.addText(slideSpec.title, {
        placeholder: "title",
        color: hexNoHash(variant.colors.accent1),
        bold: true,
        fontSize: 24,
      });
    }

    const subtitlePh = layout.placeholders.find((p) => p.type === "subTitle");
    if (subtitlePh && slideSpec.subtitle) {
      slide.addText(slideSpec.subtitle, {
        placeholder: "subTitle",
        color: hexNoHash(variant.colors.dk2),
        fontSize: 16,
      });
    }

    const bodyPh = layout.placeholders.find((p) => p.type === "body");
    if (bodyPh) {
      if (slideSpec.bullets && slideSpec.bullets.length > 0) {
        slide.addText(
          slideSpec.bullets.map((b) => ({ text: b, options: { bullet: true, breakLine: true } })),
          { placeholder: "body", color: hexNoHash(variant.colors.dk1), fontSize: 16 }
        );
      } else if (slideSpec.body) {
        slide.addText(slideSpec.body, {
          placeholder: "body",
          color: hexNoHash(variant.colors.dk1),
          fontSize: 14,
        });
      }
    }

    const picPh = layout.placeholders.find((p) => p.type === "picture");
    if (picPh && slideSpec.imageCount > 0) {
      slide.addShape("rect", {
        x: picPh.x,
        y: picPh.y,
        w: picPh.w,
        h: picPh.h,
        line: { color: hexNoHash(variant.colors.dk2), dashType: "dash", width: 1 },
        fill: { color: "FFFFFF", transparency: 100 },
      });
      slide.addText("Image placeholder", {
        x: picPh.x,
        y: picPh.y,
        w: picPh.w,
        h: picPh.h,
        align: "center",
        valign: "middle",
        color: hexNoHash(variant.colors.dk2),
        fontSize: 11,
      });
    }
  }

  return pptx;
}

async function writePresentation(theme, variantId, slides, outputPath) {
  const pptx = buildPresentation(theme, variantId, slides);
  await pptx.writeFile({ fileName: outputPath });
  return outputPath;
}

module.exports = {
  loadTheme,
  getVariant,
  resolveLayoutForSlide,
  layoutHasPlaceholderType,
  buildPresentation,
  writePresentation,
};

if (require.main === module) {
  const [themePath, slidesPath, variantId, outputPath] = process.argv.slice(2);
  if (!themePath || !slidesPath || !variantId || !outputPath) {
    console.error("Usage: node generate-pptx.js <theme.json> <slides.json> <variantId> <output.pptx>");
    process.exit(1);
  }
  try {
    const theme = loadTheme(themePath);
    const slides = JSON.parse(fs.readFileSync(slidesPath, "utf8"));
    if (!Array.isArray(slides)) {
      throw new Error(`Expected ${slidesPath} to contain a JSON array of slides, got ${typeof slides}.`);
    }
    writePresentation(theme, variantId, slides, outputPath)
      .then(() => console.log(`Wrote ${outputPath}`))
      .catch((err) => {
        console.error(err.message);
        process.exit(1);
      });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
