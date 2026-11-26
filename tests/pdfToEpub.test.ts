import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import {
  buildGeneratedEpubKey,
  buildExtractedAssetKey,
  isDerivedStorageKey,
  sanitizeStorageBookId,
} from "../shared/b2StoragePaths";
import {
  computeSha256,
  deleteUserBookmark,
  readCanonicalStructure,
  readUserBookmarks,
  resolveBookConversionOverview,
  saveCanonicalStructure,
  saveUserBookmark,
  searchCanonicalBook,
} from "../server/canonicalBookStore";
import { extractCanonicalBookFromPdf } from "../server/pdfExtractor";
import { buildEpub3FromCanonicalStructure } from "../server/epubBuilder";
import { assessConversionQuality, validateEpub3Archive } from "../server/epubValidator";
import { runPdfToEpubConversion } from "../server/pdfToEpubPipeline";
import type { CanonicalBookStructure } from "../src/types";

const SAMPLE_PDF_PATH = path.resolve(
  process.cwd(),
  "uploads/curriculums/KCSE/Physics/KLB BOOK 1 PHYSICS.pdf"
);

// Minimal valid 1x1 PNG buffer for embedded image tests
const TINY_PNG_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

test("Derived storage keys keep original PDF prefix untouched and separate EPUB/assets", () => {
  const safeId = sanitizeStorageBookId("book/physics form 1");
  assert.equal(safeId, "book-physics-form-1");

  const epubKey = buildGeneratedEpubKey("book-123", 2);
  const assetKey = buildExtractedAssetKey("book-123", "page-4-fig-1.png");

  assert.equal(epubKey, "generated-epubs/book-123/v2/book.epub");
  assert.equal(assetKey, "extracted-assets/book-123/page-4-fig-1.png");
  assert.equal(isDerivedStorageKey(epubKey), true);
  assert.equal(isDerivedStorageKey(assetKey), true);
  assert.equal(isDerivedStorageKey("curriculums/KCSE/Physics/KLB BOOK 1 PHYSICS.pdf"), false);
});

test("buildEpub3FromCanonicalStructure builds valid EPUB 3 with MathML, tables, images, and anchors", async () => {
  const sampleStructure: CanonicalBookStructure = {
    bookId: "test-phys-1",
    title: "Form 1 Physics Test Edition",
    author: "Kenya Literature Bureau",
    publisher: "KLB",
    language: "en",
    totalPages: 24,
    sourcePdfKey: "curriculums/KCSE/Physics/form1.pdf",
    sourceChecksum: "abc123",
    epubPublished: true,
    tocSource: "layout_heuristics",
    updatedAt: new Date().toISOString(),
    assets: [
      {
        id: "asset-fig-1",
        bookId: "test-phys-1",
        assetType: "diagram",
        storageKey: "extracted-assets/test-phys-1/page-3-fig-1.png",
        mimeType: "image/png",
        width: 1,
        height: 1,
        pdfPageNumber: 3,
        caption: "Figure 1.1: Vernier Callipers Scale",
      },
    ],
    chapters: [
      {
        id: "ch-1",
        stableId: "ch-1-measurement",
        chapterNumber: 1,
        title: "Chapter 1: Measurement",
        hierarchyLevel: 1,
        sectionType: "chapter",
        orderIndex: 0,
        pdfPageStart: 1,
        pdfPageEnd: 12,
        epubHref: "chapters/chapter-1.xhtml",
        epubAnchor: "ch-1",
        contentRef: "chapters/chapter-1.xhtml#ch-1",
        sections: [
          {
            id: "sec-1-1",
            stableId: "sec-1-1-density",
            chapterId: "ch-1",
            title: "1.1 Density and Relative Density",
            hierarchyLevel: 2,
            sectionType: "section",
            orderIndex: 1,
            pdfPageStart: 3,
            pdfPageEnd: 8,
            epubHref: "chapters/chapter-1.xhtml",
            epubAnchor: "sec-1-1",
            contentRef: "chapters/chapter-1.xhtml#sec-1-1",
            blocks: [
              {
                id: "blk-1",
                type: "learning_objective",
                orderIndex: 1,
                text: "Determine the density of regular and irregular solids.",
                pdfPageNumber: 3,
                epubAnchor: "blk-1",
              },
              {
                id: "blk-2",
                type: "math",
                orderIndex: 2,
                text: "rho = m / V",
                latex: "\\rho = \\frac{m}{V}",
                pdfPageNumber: 4,
                epubAnchor: "blk-2",
              },
              {
                id: "blk-3",
                type: "image",
                orderIndex: 3,
                text: "Vernier Callipers Scale",
                assetId: "asset-fig-1",
                caption: "Figure 1.1: Vernier Callipers Scale",
                pdfPageNumber: 3,
                epubAnchor: "blk-3",
              },
              {
                id: "blk-4",
                type: "table",
                orderIndex: 4,
                text: "Substance Densities",
                tableData: {
                  headers: ["Material", "Density (kg/m3)"],
                  rows: [
                    ["Water", "1000"],
                    ["Copper", "8900"],
                  ],
                },
                pdfPageNumber: 5,
                epubAnchor: "blk-4",
              },
              {
                id: "blk-5",
                type: "exercise",
                orderIndex: 5,
                text: "Exercise 1: Calculate the mass of 200 cm3 of mercury.",
                pdfPageNumber: 8,
                epubAnchor: "blk-5",
              },
            ],
          },
        ],
        blocks: [
          {
            id: "blk-intro",
            type: "paragraph",
            orderIndex: 0,
            text: "Measurement forms the empirical foundation of experimental physics.",
            pdfPageNumber: 1,
            epubAnchor: "blk-intro",
          },
        ],
      },
    ],
  };

  const epubBuf = await buildEpub3FromCanonicalStructure({
    structure: sampleStructure,
    embeddedAssets: [
      {
        asset: sampleStructure.assets[0],
        buffer: TINY_PNG_BUFFER,
      },
    ],
  });

  const validation = await validateEpub3Archive(epubBuf, { runExternalEpubCheck: false });
  assert.equal(validation.passed, true, `Expected EPUB validation to pass, errors: ${validation.errors.join("; ")}`);
  assert.equal(validation.errors.length, 0);

  const zip = await JSZip.loadAsync(epubBuf);
  const opf = await zip.file("OEBPS/content.opf")!.async("text");
  const nav = await zip.file("OEBPS/nav.xhtml")!.async("text");
  const ch1 = await zip.file("OEBPS/chapters/chapter-1.xhtml")!.async("text");

  assert.match(opf, /properties="mathml"/);
  assert.match(nav, /epub:type="toc"/);
  assert.match(nav, /chapters\/chapter-1\.xhtml#sec-1-1/);
  assert.match(ch1, /<math[\s\S]*<\/math>/);
  assert.match(ch1, /<img src="\.\.\/images\/page-3-fig-1\.png"/);
  assert.match(ch1, /<table>/);
  assert.ok(zip.file("OEBPS/images/page-3-fig-1.png"));
});

test("validateEpub3Archive rejects corrupt/invalid EPUB and quality scorer refuses auto-publish", async () => {
  const brokenZip = new JSZip();
  brokenZip.file("OEBPS/broken.txt", "not an epub");
  const badBuf = await brokenZip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

  const validation = await validateEpub3Archive(badBuf, { runExternalEpubCheck: false });
  assert.equal(validation.passed, false);
  assert.ok(validation.errors.length > 0);

  const report = assessConversionQuality({
    bookId: "bad-book",
    jobId: "job-1",
    structure: {
      bookId: "bad-book",
      title: "Broken",
      author: "Unknown",
      language: "en",
      totalPages: 10,
      sourcePdfKey: "curriculums/KCSE/Physics/bad.pdf",
      sourceChecksum: "deadbeef",
      epubPublished: false,
      tocSource: "layout_heuristics",
      updatedAt: new Date().toISOString(),
      chapters: [],
      assets: [],
    },
    validation,
    scannedPagesCount: 0,
    ocrSuccessPages: [],
    ocrFailedPages: [],
    emptyTextPagesCount: 10,
    unpreservedMathCount: 0,
    missingAssetsCount: 0,
  });

  assert.equal(report.confidenceStatus, "low");
  assert.equal(report.autoPublished, false);
  assert.equal(report.validationPassed, false);
});

test("Corrupted PDF fails validation cleanly without crashing", async () => {
  await assert.rejects(
    () =>
      extractCanonicalBookFromPdf({
        bookId: "corrupt-pdf",
        title: "Corrupt",
        sourcePdfKey: "curriculums/KCSE/Physics/corrupt.pdf",
        pdfBuffer: Buffer.from("NOT_A_PDF_FILE"),
      }),
    /Invalid PDF binary/
  );
});

test("Canonical store persists structures, searches passages, and manages bookmarks/progress cleanly", () => {
  const tmpUploads = fs.mkdtempSync(path.join(os.tmpdir(), "eduai-lib-test-"));
  try {
    const structure: CanonicalBookStructure = {
      bookId: "store-test-1",
      title: "Chemistry Form 2",
      author: "KLB",
      language: "en",
      totalPages: 40,
      sourcePdfKey: "curriculums/KCSE/Chemistry/form2.pdf",
      sourceChecksum: "112233",
      epubPublished: false,
      tocSource: "hybrid",
      updatedAt: new Date().toISOString(),
      assets: [],
      chapters: [
        {
          id: "ch-1",
          stableId: "ch-1",
          chapterNumber: 1,
          title: "Chapter 1: Atomic Structure",
          hierarchyLevel: 1,
          sectionType: "chapter",
          orderIndex: 0,
          pdfPageStart: 1,
          pdfPageEnd: 20,
          epubHref: "chapters/chapter-1.xhtml",
          epubAnchor: "ch-1",
          contentRef: "chapters/chapter-1.xhtml#ch-1",
          sections: [],
          blocks: [
            {
              id: "blk-atom",
              type: "paragraph",
              orderIndex: 1,
              text: "An atom consists of a dense positively charged nucleus containing protons and neutrons.",
              pdfPageNumber: 4,
              epubAnchor: "blk-atom",
            },
          ],
        },
      ],
    };

    saveCanonicalStructure(tmpUploads, structure, null);
    const loaded = readCanonicalStructure(tmpUploads, "store-test-1");
    assert.ok(loaded);
    assert.equal(loaded!.chapters[0].title, "Chapter 1: Atomic Structure");

    const hits = searchCanonicalBook(loaded!, "nucleus protons");
    assert.equal(hits.length, 1);
    assert.equal(hits[0].pdfPageNumber, 4);
    assert.equal(hits[0].epubHref, "chapters/chapter-1.xhtml");

    saveUserBookmark(tmpUploads, {
      id: "bm-1",
      bookId: "store-test-1",
      userId: "user-1",
      bookTitle: "Chemistry Form 2",
      title: "Atomic Structure p.4",
      chapter: "Chapter 1: Atomic Structure",
      textSnippet: "nucleus containing protons",
      canonicalSectionId: "ch-1",
      epubHref: "chapters/chapter-1.xhtml",
      epubAnchor: "ch-1",
      format: "pdf",
      pageNumber: 4,
      timestamp: Date.now(),
    });
    assert.equal(readUserBookmarks(tmpUploads, "user-1", "store-test-1").length, 1);
    assert.equal(deleteUserBookmark(tmpUploads, "user-1", "bm-1"), true);
    assert.equal(readUserBookmarks(tmpUploads, "user-1", "store-test-1").length, 0);

    const overview = resolveBookConversionOverview(tmpUploads, "store-test-1", {
      rightsConversionAllowed: true,
    });
    assert.equal(overview.chaptersCount, 1);
  } finally {
    fs.rmSync(tmpUploads, { recursive: true, force: true });
  }
});

function buildSampleMultiPagePdf(pages: Array<{ lines: Array<{ text: string; size: number; y: number }> }>): Buffer {
  const objects: string[] = [];
  const pageObjNums: number[] = [];

  // 1 = Catalog, 2 = Pages, 3 = Font
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objects.push("PLACEHOLDER_PAGES");
  objects.push("3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");

  let nextObj = 4;
  for (const p of pages) {
    const pageObj = nextObj++;
    const contentObj = nextObj++;
    pageObjNums.push(pageObj);

    const streamOps = p.lines
      .map((l) => {
        const esc = l.text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
        return `BT /F1 ${l.size} Tf 50 ${l.y} Td (${esc}) Tj ET`;
      })
      .join("\n");

    objects.push(
      `${pageObj} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObj} 0 R >>\nendobj\n`
    );
    objects.push(
      `${contentObj} 0 obj\n<< /Length ${Buffer.byteLength(streamOps, "utf-8")} >>\nstream\n${streamOps}\nendstream\nendobj\n`
    );
  }

  objects[1] = `2 0 obj\n<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(" ")}] /Count ${pageObjNums.length} >>\nendobj\n`;

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf-8"));
    pdf += obj;
  }
  const xrefOffset = Buffer.byteLength(pdf, "utf-8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "utf-8");
}

test("Full 12-stage PDF-to-EPUB 3 pipeline preserves original PDF checksum and generates valid EPUB 3", async () => {
  const tmpUploads = fs.mkdtempSync(path.join(os.tmpdir(), "eduai-real-pdf-"));
  try {
    const sourceRelKey = "curriculums/KCSE/Physics/KLB BOOK 1 PHYSICS.pdf";
    const destPdfPath = path.join(tmpUploads, sourceRelKey);
    fs.mkdirSync(path.dirname(destPdfPath), { recursive: true });

    if (fs.existsSync(SAMPLE_PDF_PATH)) {
      fs.copyFileSync(SAMPLE_PDF_PATH, destPdfPath);
    } else {
      const sampleBuf = buildSampleMultiPagePdf([
        {
          lines: [
            { text: "Chapter 1: Introduction to Physics", size: 20, y: 720 },
            { text: "1.1 Scope of Physics and Measurement", size: 14, y: 685 },
            { text: "Physics is a natural science that studies matter, energy, and their interactions.", size: 11, y: 655 },
            { text: "Accurate measurement of length, mass, and time requires standard SI units.", size: 11, y: 635 },
          ],
        },
        {
          lines: [
            { text: "Chapter 2: Force and Motion", size: 20, y: 720 },
            { text: "2.1 Types of Forces in Mechanics", size: 14, y: 685 },
            { text: "A force is a push or pull that changes the state of rest or uniform motion of a body.", size: 11, y: 655 },
            { text: "Exercise 2: Calculate the resultant force acting on a 4 kg block accelerating at 2 m/s^2.", size: 11, y: 625 },
          ],
        },
      ]);
      fs.writeFileSync(destPdfPath, sampleBuf);
    }

    const originalChecksumBefore = computeSha256(fs.readFileSync(destPdfPath));

    const result = await runPdfToEpubConversion(
      {
        bookId: "klb-physics-1-test",
        title: "KLB Secondary Physics Book 1",
        author: "Kenya Literature Bureau",
        publisher: "KLB",
        language: "en",
        sourcePdfKey: sourceRelKey,
        rightsConversionAllowed: true,
      },
      {
        uploadsDir: tmpUploads,
        getS3Client: () => null,
        getSupabase: () => null,
      }
    );

    // Verify original PDF untouched
    const originalChecksumAfter = computeSha256(fs.readFileSync(destPdfPath));
    assert.equal(originalChecksumAfter, originalChecksumBefore);

    assert.ok(result.structure, "Expected CanonicalBookStructure to be generated");
    assert.ok(result.structure!.totalPages >= 2);
    assert.ok(result.structure!.chapters.length >= 2);

    const artifact = result.overview?.artifact;
    assert.ok(artifact, "Expected EpubArtifactInfo in overview");
    assert.equal(artifact!.validationPassed, true);
    assert.ok(artifact!.epubKey.startsWith("generated-epubs/"));
    assert.ok(fs.existsSync(path.join(tmpUploads, artifact!.epubKey)));

    const generatedBuf = fs.readFileSync(path.join(tmpUploads, artifact!.epubKey));
    const check = await validateEpub3Archive(generatedBuf, { runExternalEpubCheck: false });
    assert.equal(check.passed, true);
  } finally {
    fs.rmSync(tmpUploads, { recursive: true, force: true });
  }
});
