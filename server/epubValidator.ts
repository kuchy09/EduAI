import JSZip from "jszip";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";
import type {
  CanonicalBookStructure,
  ConversionConfidence,
  ConversionQualityReport,
} from "../src/types";

const execFileAsync = promisify(execFile);

export interface EpubValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  checkedWithEpubCheckCli: boolean;
}

function resolveZipPath(baseDir: string, relHref: string): string {
  const noAnchor = relHref.split("#")[0].replace(/^\/+/, "");
  if (!baseDir) return noAnchor;
  const parts = baseDir.split("/").filter(Boolean);
  for (const seg of noAnchor.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}

function extractXmlTags(xml: string, tagRegex: RegExp): string[] {
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(xml)) !== null) {
    out.push(match[0]);
  }
  return out;
}

function getAttr(tag: string, attrName: string): string | undefined {
  const m = tag.match(new RegExp(`\\b${attrName}\\s*=\\s*["']([^"']*)["']`, "i"));
  return m?.[1];
}

async function runExternalEpubCheckIfAvailable(epubBuffer: Buffer): Promise<{
  available: boolean;
  passed?: boolean;
  errors?: string[];
  warnings?: string[];
}> {
  const customCmd = process.env.EPUBCHECK_CMD || "epubcheck";
  const tmpFile = path.join(os.tmpdir(), `eduai-epubcheck-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.epub`);
  try {
    fs.writeFileSync(tmpFile, epubBuffer);
    const { stdout, stderr } = await execFileAsync(customCmd, [tmpFile], { timeout: 20000 });
    const combined = `${stdout || ""}\n${stderr || ""}`.trim();
    return {
      available: true,
      passed: true,
      errors: [],
      warnings: combined ? [combined.slice(0, 500)] : [],
    };
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      return { available: false };
    }
    const output = `${err?.stdout || ""}\n${err?.stderr || err?.message || ""}`.trim();
    const lines = output
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const errs = lines.filter((l) => /ERROR|FATAL/i.test(l)).slice(0, 15);
    const warns = lines.filter((l) => /WARNING/i.test(l)).slice(0, 15);
    return {
      available: true,
      passed: errs.length === 0,
      errors: errs.length > 0 ? errs : [output.slice(0, 400) || "EPUBCheck reported validation failure"],
      warnings: warns,
    };
  } finally {
    try {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    } catch (_) {}
  }
}

/**
 * Validates an EPUB 3 archive against structural, OPF, navigation, manifest,
 * internal link/anchor, and embedded image requirements (plus optional EPUBCheck CLI).
 */
export async function validateEpub3Archive(
  epubBuffer: Buffer,
  options?: { runExternalEpubCheck?: boolean }
): Promise<EpubValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let checkedWithEpubCheckCli = false;

  if (!Buffer.isBuffer(epubBuffer) || epubBuffer.length < 128) {
    return {
      passed: false,
      errors: ["EPUB archive buffer is empty or truncated (<128 bytes)."],
      warnings,
      checkedWithEpubCheckCli,
    };
  }

  // 1. Verify ZIP local file header + uncompressed mimetype entry first in archive
  if (epubBuffer[0] !== 0x50 || epubBuffer[1] !== 0x4b || epubBuffer[2] !== 0x03 || epubBuffer[3] !== 0x04) {
    errors.push("Invalid ZIP signature at byte 0; EPUB must be a valid OCF ZIP container.");
  } else {
    const firstFilenameLen = epubBuffer.readUInt16LE(26);
    const compressionMethod = epubBuffer.readUInt16LE(8);
    const firstFilename = epubBuffer.subarray(30, 30 + firstFilenameLen).toString("utf-8");
    if (firstFilename !== "mimetype") {
      errors.push(`First ZIP entry must be 'mimetype', found '${firstFilename || "unknown"}'.`);
    }
    if (compressionMethod !== 0) {
      errors.push("ZIP entry 'mimetype' must be stored uncompressed (compression method 0 / STORE).");
    }
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(epubBuffer);
  } catch (err: any) {
    return {
      passed: false,
      errors: [...errors, `Unable to unpack EPUB ZIP archive: ${err?.message || "corrupt ZIP"}`],
      warnings,
      checkedWithEpubCheckCli,
    };
  }

  // 2. Check mimetype content
  const mimetypeEntry = zip.file("mimetype");
  if (!mimetypeEntry) {
    errors.push("Missing required 'mimetype' file.");
  } else {
    const mimeStr = (await mimetypeEntry.async("text")).trim();
    if (mimeStr !== "application/epub+zip") {
      errors.push(`Invalid mimetype content '${mimeStr}'; expected 'application/epub+zip'.`);
    }
  }

  // 3. Check META-INF/container.xml and locate OPF rootfile
  const containerEntry = zip.file("META-INF/container.xml");
  let opfPath = "OEBPS/content.opf";
  if (!containerEntry) {
    errors.push("Missing required 'META-INF/container.xml'.");
  } else {
    const containerXml = await containerEntry.async("text");
    const rootfileMatch = containerXml.match(/<rootfile\b[^>]*full-path\s*=\s*["']([^"']+)["']/i);
    if (!rootfileMatch?.[1]) {
      errors.push("META-INF/container.xml does not declare a <rootfile full-path=.../>.");
    } else {
      opfPath = rootfileMatch[1].trim();
    }
  }

  const opfEntry = zip.file(opfPath);
  if (!opfEntry) {
    errors.push(`Package OPF file '${opfPath}' referenced by container.xml is missing.`);
    return { passed: false, errors, warnings, checkedWithEpubCheckCli };
  }

  const opfDir = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/")) : "";
  const opfXml = await opfEntry.async("text");

  // 4. Verify EPUB 3.0 package metadata
  if (!/<package\b[^>]*version\s*=\s*["']3\.0["']/i.test(opfXml)) {
    warnings.push("Package OPF does not explicitly specify version='3.0'.");
  }
  if (!/<dc:title\b[^>]*>[\s\S]*?<\/dc:title>/i.test(opfXml)) {
    errors.push("OPF metadata is missing required <dc:title>.");
  }
  if (!/<dc:language\b[^>]*>[\s\S]*?<\/dc:language>/i.test(opfXml)) {
    errors.push("OPF metadata is missing required <dc:language>.");
  }
  if (!/<dc:identifier\b[^>]*>[\s\S]*?<\/dc:identifier>/i.test(opfXml)) {
    errors.push("OPF metadata is missing required <dc:identifier>.");
  }
  if (!/<meta\b[^>]*property\s*=\s*["']dcterms:modified["'][^>]*>/i.test(opfXml)) {
    errors.push("EPUB 3 OPF metadata is missing required dcterms:modified timestamp.");
  }

  // 5. Validate manifest items exist in ZIP & check nav document
  const itemTags = extractXmlTags(opfXml, /<item\b[^>]*\/?>/gi);
  const manifestById = new Map<string, { href: string; absPath: string; mediaType: string; properties: string }>();
  let navAbsPath: string | null = null;

  for (const tag of itemTags) {
    const id = getAttr(tag, "id") || "";
    const href = getAttr(tag, "href") || "";
    const mediaType = getAttr(tag, "media-type") || "";
    const properties = getAttr(tag, "properties") || "";
    if (!id || !href) {
      errors.push(`Invalid manifest <item> missing id or href: ${tag}`);
      continue;
    }
    const absPath = resolveZipPath(opfDir, href);
    manifestById.set(id, { href, absPath, mediaType, properties });

    if (!zip.file(absPath)) {
      errors.push(`Manifest item '${id}' points to missing archive file '${absPath}'.`);
    }
    if (properties.split(/\s+/).includes("nav")) {
      navAbsPath = absPath;
    }
  }

  if (!navAbsPath) {
    errors.push("EPUB 3 manifest must declare a navigation document with properties='nav'.");
  } else {
    const navEntry = zip.file(navAbsPath);
    if (!navEntry) {
      errors.push(`Navigation document '${navAbsPath}' is missing.`);
    } else {
      const navXhtml = await navEntry.async("text");
      if (!/epub:type\s*=\s*["'][^"']*\btoc\b[^"']*["']/i.test(navXhtml)) {
        errors.push("Navigation document is missing <nav epub:type='toc'> landmark.");
      }
      // Verify every link target and optional fragment ID exists in target XHTML
      const navDir = navAbsPath.includes("/") ? navAbsPath.slice(0, navAbsPath.lastIndexOf("/")) : "";
      const linkMatches = extractXmlTags(navXhtml, /<a\b[^>]*href\s*=\s*["'][^"']+["'][^>]*>/gi);
      if (linkMatches.length === 0) {
        warnings.push("Navigation document contains zero TOC links.");
      }
      for (const aTag of linkMatches) {
        const href = getAttr(aTag, "href");
        if (!href || /^https?:/i.test(href) || href.startsWith("mailto:")) continue;
        const [targetRel, fragment] = href.split("#");
        const targetAbs = targetRel ? resolveZipPath(navDir, targetRel) : navAbsPath;
        const targetEntry = zip.file(targetAbs);
        if (!targetEntry) {
          errors.push(`Broken TOC link in nav.xhtml -> '${href}' (file '${targetAbs}' missing).`);
        } else if (fragment) {
          const targetHtml = await targetEntry.async("text");
          const escapedFrag = fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          if (!new RegExp(`\\bid\\s*=\\s*["']${escapedFrag}["']`, "i").test(targetHtml)) {
            errors.push(`Broken TOC anchor in nav.xhtml -> '${href}' (id="${fragment}" not found in ${targetAbs}).`);
          }
        }
      }
    }
  }

  // 6. Validate spine references and internal links / image references in XHTML spine items
  const spineTags = extractXmlTags(opfXml, /<itemref\b[^>]*\/?>/gi);
  if (spineTags.length === 0) {
    errors.push("OPF <spine> contains zero reading items.");
  }

  const chapterCache = new Map<string, string>();
  for (const tag of spineTags) {
    const idref = getAttr(tag, "idref") || "";
    const item = manifestById.get(idref);
    if (!item) {
      errors.push(`Spine <itemref idref='${idref}'/> references undeclared manifest id.`);
      continue;
    }
    const entry = zip.file(item.absPath);
    if (!entry) continue;
    const xhtml = await entry.async("text");
    chapterCache.set(item.absPath, xhtml);

    if (!/<html\b/i.test(xhtml) || !/<body\b/i.test(xhtml)) {
      errors.push(`Spine XHTML '${item.absPath}' is malformed (missing <html> or <body>).`);
    }

    const itemDir = item.absPath.includes("/") ? item.absPath.slice(0, item.absPath.lastIndexOf("/")) : "";

    // Verify <img src="..."> targets exist inside the EPUB ZIP
    const imgTags = extractXmlTags(xhtml, /<img\b[^>]*>/gi);
    for (const imgTag of imgTags) {
      const src = getAttr(imgTag, "src");
      if (!src || src.startsWith("data:") || /^https?:/i.test(src)) continue;
      const imgAbs = resolveZipPath(itemDir, src);
      if (!zip.file(imgAbs)) {
        errors.push(`Missing embedded image '${imgAbs}' referenced in '${item.absPath}'.`);
      }
    }

    // Verify internal <a href="..."> chapter/section links
    const internalLinks = extractXmlTags(xhtml, /<a\b[^>]*href\s*=\s*["'][^"']+["'][^>]*>/gi);
    for (const aTag of internalLinks) {
      const href = getAttr(aTag, "href");
      if (!href || /^https?:/i.test(href) || href.startsWith("mailto:") || href.startsWith("#")) continue;
      const [relTarget, frag] = href.split("#");
      const targetAbs = resolveZipPath(itemDir, relTarget);
      if (!zip.file(targetAbs)) {
        errors.push(`Broken internal link '${href}' in '${item.absPath}'.`);
      } else if (frag) {
        const html = chapterCache.get(targetAbs) || (await zip.file(targetAbs)!.async("text"));
        chapterCache.set(targetAbs, html);
        const escapedFrag = frag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (!new RegExp(`\\bid\\s*=\\s*["']${escapedFrag}["']`, "i").test(html)) {
          errors.push(`Broken anchor link '${href}' in '${item.absPath}'.`);
        }
      }
    }
  }

  // 7. Optional external EPUBCheck CLI execution when installed in production worker
  if (options?.runExternalEpubCheck !== false) {
    const cliRes = await runExternalEpubCheckIfAvailable(epubBuffer);
    if (cliRes.available) {
      checkedWithEpubCheckCli = true;
      if (cliRes.errors?.length) errors.push(...cliRes.errors);
      if (cliRes.warnings?.length) warnings.push(...cliRes.warnings);
    }
  }

  return {
    passed: errors.length === 0,
    errors: Array.from(new Set(errors)),
    warnings: Array.from(new Set(warnings)),
    checkedWithEpubCheckCli,
  };
}

/**
 * Evaluates conversion fidelity across text coverage, OCR usage, chapter/section balance,
 * extracted assets, math preservation, page mappings, and EPUB validation status.
 */
export function assessConversionQuality(params: {
  bookId: string;
  jobId: string;
  structure: CanonicalBookStructure;
  validation: EpubValidationResult;
  scannedPagesCount: number;
  ocrSuccessPages: number[];
  ocrFailedPages: number[];
  emptyTextPagesCount: number;
  unpreservedMathCount: number;
  missingAssetsCount: number;
}): ConversionQualityReport {
  const {
    bookId,
    jobId,
    structure,
    validation,
    scannedPagesCount,
    ocrSuccessPages,
    ocrFailedPages,
    emptyTextPagesCount,
    unpreservedMathCount,
    missingAssetsCount,
  } = params;

  const totalPages = Math.max(1, structure.totalPages || 1);
  const warnings: string[] = [...validation.warnings];
  const errors: string[] = [...validation.errors];

  const chapters = structure.chapters || [];
  const totalSections = chapters.reduce((sum, ch) => sum + (ch.sections?.length || 0), 0);
  const allBlocks = chapters.flatMap((ch) => [
    ...(ch.blocks || []),
    ...(ch.sections || []).flatMap((sec) => sec.blocks || []),
  ]);
  const totalWords = allBlocks.reduce((sum, b) => sum + (b.text ? b.text.split(/\s+/).filter(Boolean).length : 0), 0);
  const imageCount = allBlocks.filter((b) => b.type === "image").length;
  const tableCount = allBlocks.filter((b) => b.type === "table").length;
  const mathCount = allBlocks.filter((b) => b.type === "math").length;

  let score = 100;

  if (!validation.passed) {
    score -= 45;
  }

  const emptyRatio = emptyTextPagesCount / totalPages;
  if (emptyRatio > 0.5) {
    score -= 35;
    errors.push(`High missing-text ratio (${emptyTextPagesCount}/${totalPages} pages had almost no extractable text).`);
  } else if (emptyRatio > 0.15) {
    score -= 15;
    warnings.push(`${emptyTextPagesCount} of ${totalPages} pages yielded low or missing text.`);
  }

  if (ocrFailedPages.length > 0) {
    score -= Math.min(25, ocrFailedPages.length * 4);
    warnings.push(`OCR could not cleanly decode ${ocrFailedPages.length} scanned page(s): ${ocrFailedPages.slice(0, 8).join(", ")}.`);
  } else if (scannedPagesCount > 0 && ocrSuccessPages.length > 0) {
    score -= Math.min(8, Math.ceil((scannedPagesCount / totalPages) * 8));
    warnings.push(`Applied OCR on ${ocrSuccessPages.length} scanned page(s); spot-check typography recommended.`);
  }

  if (chapters.length === 0) {
    score -= 40;
    errors.push("No chapters were detected in the textbook.");
  } else if (chapters.length === 1 && totalPages > 25) {
    score -= 18;
    warnings.push("Only 1 chapter boundary was detected across a multi-chapter textbook; verify Table of Contents.");
  }

  const emptyChapters = chapters.filter((ch) => {
    const chBlocks = (ch.blocks?.length || 0) + (ch.sections || []).reduce((s, sec) => s + (sec.blocks?.length || 0), 0);
    return chBlocks === 0;
  });
  if (emptyChapters.length > 0) {
    score -= Math.min(20, emptyChapters.length * 6);
    warnings.push(`${emptyChapters.length} chapter(s) have zero extracted content blocks.`);
  }

  const invalidPageMappings = chapters.filter(
    (ch) => ch.pdfPageStart < 1 || ch.pdfPageEnd < ch.pdfPageStart || ch.pdfPageEnd > totalPages
  );
  if (invalidPageMappings.length > 0) {
    score -= 15;
    errors.push(`${invalidPageMappings.length} chapter(s) have invalid PDF page bounds.`);
  }

  if (missingAssetsCount > 0) {
    score -= Math.min(20, missingAssetsCount * 5);
    warnings.push(`${missingAssetsCount} embedded diagram/image asset(s) could not be extracted cleanly.`);
  }

  if (unpreservedMathCount > 0) {
    score -= Math.min(14, unpreservedMathCount * 2);
    warnings.push(`${unpreservedMathCount} mathematical expression(s) fell back to plain text instead of MathML.`);
  }

  if (totalWords < Math.min(80, totalPages * 15)) {
    score -= 20;
    warnings.push(`Very low extracted word count (${totalWords} words across ${totalPages} pages).`);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let confidenceStatus: ConversionConfidence = "low";
  if (validation.passed && errors.length === 0 && score >= 82 && ocrFailedPages.length === 0) {
    confidenceStatus = "high";
  } else if (validation.passed && score >= 55) {
    confidenceStatus = "medium";
  } else {
    confidenceStatus = "low";
  }

  const autoPublished = confidenceStatus === "high" && validation.passed;

  return {
    id: `report-${bookId}-${Date.now()}`,
    bookId,
    jobId,
    confidenceStatus,
    qualityScore: score,
    totalPages,
    extractedChaptersCount: chapters.length,
    extractedSectionsCount: totalSections,
    extractedImagesCount: imageCount,
    extractedTablesCount: tableCount,
    mathBlocksCount: mathCount,
    ocrPages: ocrSuccessPages,
    warnings: Array.from(new Set(warnings)),
    errors: Array.from(new Set(errors)),
    validationPassed: validation.passed,
    autoPublished,
    createdAt: new Date().toISOString(),
  };
}
