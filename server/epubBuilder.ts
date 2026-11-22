import JSZip from "jszip";

export interface EpubChapterSpec {
  id: string;
  title: string;
  paragraphs: string[];
  callout?: string;
}

function escapeXml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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

  // Per EPUB spec, mimetype must be uncompressed first entry
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
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
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
