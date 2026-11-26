import JSZip from "jszip";
import katex from "katex";
import path from "path";
import type {
  CanonicalBookBlock,
  CanonicalBookChapter,
  CanonicalBookSection,
  CanonicalBookStructure,
  ExtractedAsset,
} from "../src/types";

export interface EpubChapterSpec {
  id: string;
  title: string;
  paragraphs: string[];
  callout?: string;
}

export interface EmbeddedImagePayload {
  asset: ExtractedAsset;
  buffer: Buffer;
  epubRelPath: string;
}

function escapeXml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sanitizeId(raw: string, fallback: string): string {
  const clean = String(raw || "")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!clean) return fallback;
  return /^[a-zA-Z]/.test(clean) ? clean : `id-${clean}`;
}

function renderLatexToMathMlSafe(latex: string): string | null {
  try {
    const clean = String(latex || "").trim();
    if (!clean) return null;
    const html = katex.renderToString(clean, {
      output: "mathml",
      throwOnError: true,
      displayMode: true,
    });
    const match = html.match(/<math[\s\S]*?<\/math>/i);
    return match ? match[0] : null;
  } catch {
    return null;
  }
}

function renderBlockToXhtml(
  block: CanonicalBookBlock,
  assetPathById: Map<string, { epubRelPath: string; asset: ExtractedAsset }>
): { xhtml: string; usedMathMl: boolean } {
  const anchorId = sanitizeId(block.epubAnchor || block.id, `blk-${block.orderIndex}`);
  const pageAttr = `data-pdf-page="${Math.max(1, block.pdfPageNumber || 1)}"`;

  if (block.type === "heading") {
    const lvl = Math.min(4, Math.max(2, block.level || 3));
    return {
      xhtml: `      <h${lvl} id="${escapeXml(anchorId)}" ${pageAttr}>${escapeXml(block.text)}</h${lvl}>`,
      usedMathMl: false,
    };
  }

  if (block.type === "image" && block.assetId) {
    const mapped = assetPathById.get(block.assetId);
    if (mapped) {
      const altText = block.caption || block.text || `Textbook diagram from page ${block.pdfPageNumber}`;
      const relFromChapters = `../${mapped.epubRelPath}`;
      return {
        xhtml: `      <figure id="${escapeXml(anchorId)}" class="edu-figure" ${pageAttr}>
        <img src="${escapeXml(relFromChapters)}" alt="${escapeXml(altText)}"/>
        <figcaption>${escapeXml(block.caption || `Figure (PDF Page ${block.pdfPageNumber})`)}</figcaption>
      </figure>`,
        usedMathMl: false,
      };
    }
    return {
      xhtml: `      <p id="${escapeXml(anchorId)}" class="figure-placeholder" ${pageAttr}>[${escapeXml(
        block.caption || block.text || `Diagram on page ${block.pdfPageNumber}`
      )}]</p>`,
      usedMathMl: false,
    };
  }

  if (block.type === "table" && block.tableData) {
    const headersHtml =
      block.tableData.headers.length > 0
        ? `        <thead><tr>${block.tableData.headers
            .map((h) => `<th>${escapeXml(h)}</th>`)
            .join("")}</tr></thead>\n`
        : "";
    const rowsHtml = block.tableData.rows
      .map(
        (r) =>
          `          <tr>${r.map((cell) => `<td>${escapeXml(cell)}</td>`).join("")}</tr>`
      )
      .join("\n");
    return {
      xhtml: `      <div id="${escapeXml(anchorId)}" class="table-wrap" ${pageAttr}>
        <table>
${headersHtml}        <tbody>
${rowsHtml}
        </tbody>
        </table>
      </div>`,
      usedMathMl: false,
    };
  }

  if (block.type === "math") {
    const mathMl =
      block.mathMl ||
      (block.latex ? renderLatexToMathMlSafe(block.latex) : null) ||
      renderLatexToMathMlSafe(block.text);
    if (mathMl && mathMl.includes("<math")) {
      return {
        xhtml: `      <div id="${escapeXml(anchorId)}" class="math-block" ${pageAttr}>
        ${mathMl}
      </div>`,
        usedMathMl: true,
      };
    }
    return {
      xhtml: `      <div id="${escapeXml(anchorId)}" class="math-fallback" ${pageAttr}><code>${escapeXml(
        block.text
      )}</code></div>`,
      usedMathMl: false,
    };
  }

  if (block.type === "exercise") {
    return {
      xhtml: `      <aside id="${escapeXml(anchorId)}" class="exercise-box" epub:type="practice" ${pageAttr}>
        <p>${escapeXml(block.text)}</p>
      </aside>`,
      usedMathMl: false,
    };
  }

  if (block.type === "learning_objective") {
    return {
      xhtml: `      <aside id="${escapeXml(anchorId)}" class="objective-box" epub:type="learning-objective" ${pageAttr}>
        <p>${escapeXml(block.text)}</p>
      </aside>`,
      usedMathMl: false,
    };
  }

  if (block.type === "callout") {
    return {
      xhtml: `      <blockquote id="${escapeXml(anchorId)}" class="callout-box" ${pageAttr}>
        <p>${escapeXml(block.text)}</p>
      </blockquote>`,
      usedMathMl: false,
    };
  }

  if (block.type === "list_item") {
    return {
      xhtml: `      <p id="${escapeXml(anchorId)}" class="list-item" ${pageAttr}>&#8226; ${escapeXml(block.text)}</p>`,
      usedMathMl: false,
    };
  }

  return {
    xhtml: `      <p id="${escapeXml(anchorId)}" ${pageAttr}>${escapeXml(block.text)}</p>`,
    usedMathMl: false,
  };
}

function buildSectionXhtml(
  section: CanonicalBookSection,
  assetPathById: Map<string, { epubRelPath: string; asset: ExtractedAsset }>
): { xhtml: string; usedMathMl: boolean } {
  const secId = sanitizeId(section.epubAnchor || section.id, `sec-${section.orderIndex}`);
  const headingTag = section.hierarchyLevel >= 3 ? "h3" : "h2";
  let usedMathMl = false;

  const renderedBlocks = (section.blocks || []).map((blk) => {
    const r = renderBlockToXhtml(blk, assetPathById);
    if (r.usedMathMl) usedMathMl = true;
    return r.xhtml;
  });

  return {
    xhtml: `    <section id="${escapeXml(secId)}" class="edu-section level-${section.hierarchyLevel}" data-pdf-page-start="${section.pdfPageStart}" data-pdf-page-end="${section.pdfPageEnd}">
      <${headingTag}>${escapeXml(section.title)}</${headingTag}>
${renderedBlocks.join("\n")}
    </section>`,
    usedMathMl,
  };
}

function renderChapterHtmlDocument(
  chapter: CanonicalBookChapter,
  language: string,
  bookTitle: string,
  assetPathById: Map<string, { epubRelPath: string; asset: ExtractedAsset }>
): { xhtml: string; usedMathMl: boolean } {
  const chId = sanitizeId(chapter.epubAnchor || chapter.id, `ch-${chapter.chapterNumber}`);
  let usedMathMl = false;

  const introBlocks = (chapter.blocks || []).map((blk) => {
    const r = renderBlockToXhtml(blk, assetPathById);
    if (r.usedMathMl) usedMathMl = true;
    return r.xhtml;
  });

  const sectionsHtml = (chapter.sections || []).map((sec) => {
    const r = buildSectionXhtml(sec, assetPathById);
    if (r.usedMathMl) usedMathMl = true;
    return r.xhtml;
  });

  const bodyInner = [
    `    <section id="${escapeXml(chId)}" epub:type="chapter" data-pdf-page-start="${chapter.pdfPageStart}" data-pdf-page-end="${chapter.pdfPageEnd}">`,
    `      <h1>${escapeXml(chapter.title)}</h1>`,
    `      <p class="page-ref">PDF Pages ${chapter.pdfPageStart}&#8211;${chapter.pdfPageEnd}</p>`,
    ...introBlocks,
    ...sectionsHtml,
    `    </section>`,
  ].join("\n");

  const xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${escapeXml(language)}" lang="${escapeXml(language)}">
  <head>
    <meta charset="utf-8"/>
    <title>${escapeXml(chapter.title)} — ${escapeXml(bookTitle)}</title>
    <link rel="stylesheet" type="text/css" href="../styles/book.css"/>
  </head>
  <body>
${bodyInner}
  </body>
</html>`;

  return { xhtml, usedMathMl };
}

/**
 * Generates a standards-compliant reflowable EPUB 3 archive from a CanonicalBookStructure
 * and optional extracted image buffers.
 */
export async function buildEpub3FromCanonicalStructure(params: {
  structure: CanonicalBookStructure;
  embeddedAssets?: Array<{ asset: ExtractedAsset; buffer: Buffer }>;
  description?: string;
}): Promise<Buffer> {
  const { structure } = params;
  const zip = new JSZip();
  const language = structure.language || "en";
  const bookTitle = structure.title || "Edu AI Curriculum Textbook";
  const author = structure.author || structure.publisher || "Edu AI Curriculum Press";
  const publisher = structure.publisher || "Edu AI Digital Publishing";
  const bookUrn = `urn:eduai:book:${sanitizeId(structure.bookId, "textbook")}`;

  // 1. Uncompressed mimetype first in archive (OCF specification)
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  // 2. META-INF/container.xml
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  // 3. Responsive EPUB 3 stylesheet
  zip.file(
    "OEBPS/styles/book.css",
    `:root { color-scheme: light dark; }
html { font-size: 100%; }
body {
  font-family: Georgia, "Times New Roman", serif;
  line-height: 1.7;
  margin: 0 auto;
  padding: 1.25rem;
  max-width: 68ch;
  word-wrap: break-word;
}
h1, h2, h3, h4 {
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  line-height: 1.25;
  margin-top: 1.6em;
  margin-bottom: 0.55em;
  break-after: avoid;
}
h1 { font-size: 1.75em; border-bottom: 1px solid rgba(120,120,120,0.25); padding-bottom: 0.35em; }
h2 { font-size: 1.35em; }
h3 { font-size: 1.15em; }
p { margin: 0 0 0.9em 0; text-align: left; }
.page-ref { font-size: 0.8em; opacity: 0.7; font-family: monospace; margin-bottom: 1.2em; }
figure.edu-figure {
  margin: 1.25em 0;
  text-align: center;
  break-inside: avoid;
}
figure.edu-figure img {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
}
figure.edu-figure figcaption {
  font-size: 0.85em;
  opacity: 0.8;
  margin-top: 0.4em;
}
.table-wrap { overflow-x: auto; margin: 1.1em 0; }
table { width: 100%; border-collapse: collapse; font-size: 0.92em; }
th, td { border: 1px solid rgba(120,120,120,0.35); padding: 0.45em 0.6em; text-align: left; }
th { font-weight: 600; background: rgba(120,120,120,0.08); }
.math-block, .math-fallback {
  margin: 1em 0;
  padding: 0.65em 0.9em;
  border-radius: 6px;
  background: rgba(120,120,120,0.07);
  overflow-x: auto;
  text-align: center;
}
aside.exercise-box, aside.objective-box, blockquote.callout-box {
  margin: 1.1em 0;
  padding: 0.85em 1em;
  border-radius: 6px;
  border: 1px solid rgba(120,120,120,0.25);
  background: rgba(120,120,120,0.06);
  font-style: normal;
}
`
  );

  // 4. Embed extracted raster images under OEBPS/images/
  const assetPathById = new Map<string, { epubRelPath: string; asset: ExtractedAsset }>();
  const assetManifestItems: string[] = [];
  let imgIdx = 0;
  for (const item of params.embeddedAssets || []) {
    if (!item.buffer || item.buffer.length === 0) continue;
    imgIdx += 1;
    const ext = item.asset.mimeType.includes("jpeg") ? "jpg" : "png";
    const filename = path.basename(item.asset.storageKey || `img-${imgIdx}.${ext}`).replace(/[^a-zA-Z0-9._-]/g, "_");
    const epubRelPath = `images/${filename}`;
    zip.file(`OEBPS/${epubRelPath}`, item.buffer);
    assetPathById.set(item.asset.id, { epubRelPath, asset: item.asset });
    assetManifestItems.push(
      `    <item id="${escapeXml(sanitizeId(item.asset.id, `img-${imgIdx}`))}" href="${escapeXml(
        epubRelPath
      )}" media-type="${escapeXml(item.asset.mimeType || "image/png")}"/>`
    );
  }

  // 5. Render chapter XHTML files & build OPF manifest/spine + nav/NCX entries
  const chapters = structure.chapters || [];
  const chapterManifestItems: string[] = [];
  const spineItems: string[] = [];
  const navChapterListItems: string[] = [];
  const ncxNavPoints: string[] = [];
  const pageListItems: string[] = [];
  const seenPageRefs = new Set<number>();

  let ncxPlayOrder = 1;

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    const cleanHref = ch.epubHref?.replace(/^OEBPS\//i, "") || `chapters/chapter-${i + 1}.xhtml`;
    const chManifestId = sanitizeId(`ch-${i + 1}-${ch.id}`, `chapter-${i + 1}`);
    const { xhtml, usedMathMl } = renderChapterHtmlDocument(ch, language, bookTitle, assetPathById);

    zip.file(`OEBPS/${cleanHref}`, xhtml);

    const propertiesAttr = usedMathMl ? ` properties="mathml"` : "";
    chapterManifestItems.push(
      `    <item id="${escapeXml(chManifestId)}" href="${escapeXml(
        cleanHref
      )}" media-type="application/xhtml+xml"${propertiesAttr}/>`
    );
    spineItems.push(`    <itemref idref="${escapeXml(chManifestId)}"/>`);

    const chAnchor = sanitizeId(ch.epubAnchor || ch.id, `ch-${i + 1}`);
    if (!seenPageRefs.has(ch.pdfPageStart)) {
      seenPageRefs.add(ch.pdfPageStart);
      pageListItems.push(
        `        <li><a href="${escapeXml(cleanHref)}#${escapeXml(chAnchor)}">Page ${ch.pdfPageStart}</a></li>`
      );
    }

    // Build nested <ol> for sections & subsections
    const sections = ch.sections || [];
    const topSections = sections.filter((s) => s.hierarchyLevel <= 2 || !s.parentSectionId);
    const sectionLis = topSections.map((sec) => {
      const secAnchor = sanitizeId(sec.epubAnchor || sec.id, `sec-${sec.orderIndex}`);
      const secHref = `${escapeXml(cleanHref)}#${escapeXml(secAnchor)}`;
      if (!seenPageRefs.has(sec.pdfPageStart)) {
        seenPageRefs.add(sec.pdfPageStart);
        pageListItems.push(`        <li><a href="${secHref}">Page ${sec.pdfPageStart}</a></li>`);
      }
      const subSections = sections.filter((sub) => sub.parentSectionId === sec.id);
      const subHtml =
        subSections.length > 0
          ? `\n            <ol>\n${subSections
              .map((sub) => {
                const subAnchor = sanitizeId(sub.epubAnchor || sub.id, `sub-${sub.orderIndex}`);
                return `              <li><a href="${escapeXml(cleanHref)}#${escapeXml(
                  subAnchor
                )}">${escapeXml(sub.title)}</a></li>`;
              })
              .join("\n")}\n            </ol>`
          : "";
      return `          <li><a href="${secHref}">${escapeXml(sec.title)}</a>${subHtml}</li>`;
    });

    const nestedOl =
      sectionLis.length > 0 ? `\n        <ol>\n${sectionLis.join("\n")}\n        </ol>` : "";
    navChapterListItems.push(
      `        <li><a href="${escapeXml(cleanHref)}#${escapeXml(chAnchor)}">${escapeXml(
        ch.title
      )}</a>${nestedOl}</li>`
    );

    const chPlayOrder = ncxPlayOrder++;
    const ncxSectionPoints = topSections
      .map((sec) => {
        const secAnchor = sanitizeId(sec.epubAnchor || sec.id, `sec-${sec.orderIndex}`);
        const secPlayOrder = ncxPlayOrder++;
        return `      <navPoint id="navPoint-${secPlayOrder}" playOrder="${secPlayOrder}">
        <navLabel><text>${escapeXml(sec.title)}</text></navLabel>
        <content src="${escapeXml(cleanHref)}#${escapeXml(secAnchor)}"/>
      </navPoint>`;
      })
      .join("\n");

    ncxNavPoints.push(`    <navPoint id="navPoint-${chPlayOrder}" playOrder="${chPlayOrder}">
      <navLabel><text>${escapeXml(ch.title)}</text></navLabel>
      <content src="${escapeXml(cleanHref)}#${escapeXml(chAnchor)}"/>${ncxSectionPoints ? `\n${ncxSectionPoints}` : ""}
    </navPoint>`);
  }

  // 6. Write OEBPS/nav.xhtml
  zip.file(
    "OEBPS/nav.xhtml",
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${escapeXml(language)}" lang="${escapeXml(language)}">
  <head>
    <meta charset="utf-8"/>
    <title>${escapeXml(bookTitle)} — Table of Contents</title>
    <link rel="stylesheet" type="text/css" href="styles/book.css"/>
  </head>
  <body>
    <nav epub:type="toc" id="toc">
      <h1>Table of Contents</h1>
      <ol>
${navChapterListItems.join("\n")}
      </ol>
    </nav>
${
  pageListItems.length > 0
    ? `    <nav epub:type="page-list" id="page-list" hidden="hidden">
      <h2>Print Page List</h2>
      <ol>
${pageListItems.join("\n")}
      </ol>
    </nav>`
    : ""
}
  </body>
</html>`
  );

  // 7. Write OEBPS/toc.ncx
  zip.file(
    "OEBPS/toc.ncx",
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${escapeXml(bookUrn)}"/>
    <meta name="dtb:depth" content="2"/>
  </head>
  <docTitle><text>${escapeXml(bookTitle)}</text></docTitle>
  <navMap>
${ncxNavPoints.join("\n")}
  </navMap>
</ncx>`
  );

  // 8. Write OEBPS/content.opf (EPUB 3.0)
  const modifiedIso = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/opf" version="3.0" unique-identifier="BookId" xml:lang="${escapeXml(language)}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">${escapeXml(bookUrn)}</dc:identifier>
    <dc:title>${escapeXml(bookTitle)}</dc:title>
    <dc:creator>${escapeXml(author)}</dc:creator>
    <dc:publisher>${escapeXml(publisher)}</dc:publisher>
    <dc:language>${escapeXml(language)}</dc:language>
    <dc:description>${escapeXml(
      params.description || `Structured reflowable EPUB 3 edition of ${bookTitle} with hierarchical TOC.`
    )}</dc:description>
    <meta property="dcterms:modified">${modifiedIso}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="css" href="styles/book.css" media-type="text/css"/>
${chapterManifestItems.join("\n")}
${assetManifestItems.join("\n")}
  </manifest>
  <spine toc="ncx">
${spineItems.join("\n")}
  </spine>
</package>`
  );

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

function buildCurriculumChapters(title: string): EpubChapterSpec[] {
  const lower = title.toLowerCase();
  if (lower.includes("physics")) {
    return [
      {
        id: "chapter-1",
        title: "Chapter 1: Thin Lenses & Optical Systems",
        paragraphs: [
          "A lens is a transparent optical medium bounded by two surfaces, at least one of which is curved. Converging (convex) lenses focus parallel rays to a real principal focus, whereas diverging (concave) lenses spread rays as if originating from a virtual focus.",
          "Using the thin lens formula 1/f = 1/u + 1/v, students can determine image position, magnification (m = v/u), and real versus virtual nature under standard KCSE Paper 2 practical setups.",
          "Optical instruments such as the compound microscope, astronomical telescope, and human eye defects (myopia and hypermetropia) apply lens combinations to control angular magnification.",
        ],
        callout: "KCSE Exam Tip: Always apply the real-is-positive sign convention consistently when calculating focal length f and image distance v.",
      },
      {
        id: "chapter-2",
        title: "Chapter 2: Uniform Circular Motion & Gravitation",
        paragraphs: [
          "An object moving in a circular path at constant speed undergoes continuous acceleration directed toward the centre of the circle because its velocity vector changes direction at every instant.",
          "Centripetal force is given by Fc = mv^2 / r = m * omega^2 * r. In banked tracks and conical pendulums, the horizontal component of normal reaction or tension supplies this inward force.",
          "Satellites in stable circular orbit balance gravitational attraction GMm/r^2 against centripetal demand mv^2/r, yielding orbital speed v = sqrt(GM/r).",
        ],
        callout: "Key Formula: Angular velocity omega = 2 * pi * f = v / r (measured in rad s^-1).",
      },
      {
        id: "chapter-3",
        title: "Chapter 3: Electromagnetic Induction & Mains Power",
        paragraphs: [
          "Faraday's Law states that the magnitude of induced electromotive force (e.m.f.) in a conductor is directly proportional to the rate of change of magnetic flux linkage.",
          "Lenz's Law guarantees conservation of energy: the direction of the induced current always opposes the change in magnetic flux that produces it.",
          "Step-up transformers raise voltage prior to long-distance national grid transmission to minimize resistive power loss P_loss = I^2 R.",
        ],
        callout: "Safety & Grid Note: Domestic Kenyan mains supply operates at 240 V r.m.s., 50 Hz with live, neutral, and earth protection.",
      },
    ];
  }

  return [
    {
      id: "chapter-1",
      title: `Chapter 1: Core Foundations of ${title}`,
      paragraphs: [
        `${title} is formatted as a reflowable EPUB 3 curriculum edition designed for adaptive reading across mobile phones, tablets, and desktop study sessions.`,
        "Unlike fixed-page PDFs, reflowable EPUB chapters automatically adapt line length, font size, serif or sans-serif typeface, and reading surface contrast (Paper, Sepia, Dark, AMOLED) without horizontal panning.",
        "This edition supports AES-256 encrypted offline vault storage in the Edu AI Flutter app, ensuring zero-connectivity study reliability while protecting publisher intellectual property.",
      ],
      callout: "Reflowable Study Mode: Adjust text size and surface contrast from the top toolbar or ask Sage AI about any highlighted concept.",
    },
    {
      id: "chapter-2",
      title: "Chapter 2: Curriculum Principles & Worked Analysis",
      paragraphs: [
        "Structured strands organize foundational definitions first, followed by quantitative derivations, guided examples, and examination review prompts.",
        "Learners can tap any unfamiliar term for instant definitions, save bookmarks synced across devices, and seal encrypted offline copies bound to their learner session.",
      ],
      callout: "Publisher Security: Encrypted offline storage prevents raw file redistribution while preserving full offline responsiveness.",
    },
    {
      id: "chapter-3",
      title: "Chapter 3: Practice Problems & Revision Checklist",
      paragraphs: [
        "1. Summarize the primary conceptual relationship introduced in Chapter 1 in your own words.",
        "2. Work through two applied derivations without referring to the solution key, then verify your steps with Sage AI Tutor.",
        "3. Review key vocabulary terms and prepare concise flashcard notes for timed revision.",
      ],
    },
  ];
}

export async function generateEducationalEpub(options: {
  id: string;
  title: string;
  author?: string;
  publisher?: string;
  description?: string;
  language?: string;
}): Promise<Buffer> {
  const zip = new JSZip();
  const title = options.title || "Edu AI Curriculum Textbook";
  const author = options.author || options.publisher || "Edu AI Curriculum Press";
  const publisher = options.publisher || "Edu AI Digital Publishing";
  const language = options.language || "en";
  const bookId = `urn:uuid:${options.id || "eduai-epub"}`;
  const chapters = buildCurriculumChapters(title);

  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  const manifestItems = chapters
    .map(
      (c) =>
        `    <item id="${escapeXml(c.id)}" href="${escapeXml(c.id)}.xhtml" media-type="application/xhtml+xml"/>`
    )
    .join("\n");

  const spineItems = chapters
    .map((c) => `    <itemref idref="${escapeXml(c.id)}"/>`)
    .join("\n");

  const navListItems = chapters
    .map(
      (c) =>
        `        <li><a href="${escapeXml(c.id)}.xhtml">${escapeXml(c.title)}</a></li>`
    )
    .join("\n");

  const ncxNavPoints = chapters
    .map(
      (c, idx) => `    <navPoint id="navPoint-${idx + 1}" playOrder="${idx + 1}">
      <navLabel><text>${escapeXml(c.title)}</text></navLabel>
      <content src="${escapeXml(c.id)}.xhtml"/>
    </navPoint>`
    )
    .join("\n");

  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/opf" version="3.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">${escapeXml(bookId)}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:creator>${escapeXml(author)}</dc:creator>
    <dc:publisher>${escapeXml(publisher)}</dc:publisher>
    <dc:language>${escapeXml(language)}</dc:language>
    <dc:description>${escapeXml(options.description || `Reflowable EPUB edition of ${title}.`)}</dc:description>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, "Z")}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
${manifestItems}
  </manifest>
  <spine toc="ncx">
${spineItems}
  </spine>
</package>`
  );

  zip.file(
    "OEBPS/nav.xhtml",
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${escapeXml(language)}">
  <head>
    <meta charset="utf-8"/>
    <title>${escapeXml(title)} - Contents</title>
  </head>
  <body>
    <nav epub:type="toc" id="toc">
      <h1>Table of Contents</h1>
      <ol>
${navListItems}
      </ol>
    </nav>
  </body>
</html>`
  );

  zip.file(
    "OEBPS/toc.ncx",
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${escapeXml(bookId)}"/>
  </head>
  <docTitle><text>${escapeXml(title)}</text></docTitle>
  <navMap>
${ncxNavPoints}
  </navMap>
</ncx>`
  );

  for (const chapter of chapters) {
    const paragraphsHtml = chapter.paragraphs
      .map((p) => `    <p>${escapeXml(p)}</p>`)
      .join("\n");
    const calloutHtml = chapter.callout
      ? `\n    <blockquote><p>${escapeXml(chapter.callout)}</p></blockquote>`
      : "";

    zip.file(
      `OEBPS/${chapter.id}.xhtml`,
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${escapeXml(language)}">
  <head>
    <meta charset="utf-8"/>
    <title>${escapeXml(chapter.title)}</title>
  </head>
  <body>
    <h1>${escapeXml(chapter.title)}</h1>
${paragraphsHtml}${calloutHtml}
  </body>
</html>`
    );
  }

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
