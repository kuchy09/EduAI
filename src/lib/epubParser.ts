import JSZip from 'jszip';

export interface ParsedEpubBlock {
  id?: string;
  type: 'heading' | 'paragraph' | 'blockquote' | 'list-item' | 'image' | 'table' | 'math';
  level?: number;
  text: string;
  imageSrc?: string;
  caption?: string;
  tableData?: { headers: string[]; rows: string[][] };
}

export interface ParsedEpubTocItem {
  label: string;
  href: string;
  anchor?: string;
  level: number;
}

export interface ParsedEpubChapter {
  id: string;
  title: string;
  href: string;
  blocks: ParsedEpubBlock[];
  plainText: string;
}

export interface ParsedEpubDocument {
  title: string;
  author: string;
  publisher?: string;
  language?: string;
  toc: ParsedEpubTocItem[];
  chapters: ParsedEpubChapter[];
  blobUrlsToRevoke: string[];
}

function resolveRelativePath(baseDir: string, relPath: string): string {
  const cleanRel = relPath.split('#')[0].replace(/^\//, '');
  if (!baseDir) return cleanRel;
  const baseParts = baseDir.split('/').filter(Boolean);
  for (const seg of cleanRel.split('/')) {
    if (seg === '.' || seg === '') continue;
    if (seg === '..') {
      baseParts.pop();
    } else {
      baseParts.push(seg);
    }
  }
  return baseParts.join('/');
}

function getZipEntry(zip: JSZip, pathCandidate: string): JSZip.JSZipObject | null {
  const exact = zip.file(pathCandidate);
  if (exact) return exact;
  try {
    const decoded = decodeURIComponent(pathCandidate);
    const byDecoded = zip.file(decoded);
    if (byDecoded) return byDecoded;
    const lower = decoded.toLowerCase();
    for (const name of Object.keys(zip.files)) {
      if (name.toLowerCase() === lower && !zip.files[name].dir) {
        return zip.files[name];
      }
    }
  } catch (_) {}
  return null;
}

async function resolveImageBlobUrl(
  zip: JSZip,
  chapterDir: string,
  src: string,
  cache: Map<string, string>,
  blobUrlsToRevoke: string[]
): Promise<string | undefined> {
  if (!src || src.startsWith('data:') || /^https?:/i.test(src)) return src || undefined;
  const absPath = resolveRelativePath(chapterDir, src);
  if (cache.has(absPath)) return cache.get(absPath);

  const entry = getZipEntry(zip, absPath);
  if (!entry) return undefined;
  try {
    const lower = absPath.toLowerCase();
    const mime = lower.endsWith('.jpg') || lower.endsWith('.jpeg')
      ? 'image/jpeg'
      : lower.endsWith('.webp')
      ? 'image/webp'
      : lower.endsWith('.svg')
      ? 'image/svg+xml'
      : 'image/png';
    const bytes = await entry.async('uint8array');
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    cache.set(absPath, url);
    blobUrlsToRevoke.push(url);
    return url;
  } catch {
    return undefined;
  }
}

async function extractBlocksFromXhtml(
  xhtml: string,
  fallbackTitle: string,
  zip: JSZip,
  chapterHref: string,
  imageCache: Map<string, string>,
  blobUrlsToRevoke: string[]
): Promise<{ title: string; blocks: ParsedEpubBlock[]; plainText: string }> {
  const parser = new DOMParser();
  let doc = parser.parseFromString(xhtml, 'application/xhtml+xml');
  if (doc.querySelector('parsererror')) {
    doc = parser.parseFromString(xhtml, 'text/html');
  }

  doc.querySelectorAll('script, style, iframe, object, embed').forEach((el) => el.remove());

  const titleFromHead = doc.querySelector('head > title')?.textContent?.trim();
  const firstHeading = doc.querySelector('h1, h2')?.textContent?.trim();
  const resolvedTitle = firstHeading || titleFromHead || fallbackTitle;

  const chapterDir = chapterHref.includes('/')
    ? chapterHref.slice(0, chapterHref.lastIndexOf('/'))
    : '';

  const blocks: ParsedEpubBlock[] = [];
  const body = doc.body || doc.documentElement;

  if (body) {
    const elements = body.querySelectorAll(
      'h1, h2, h3, h4, p, blockquote, li, figure, table, .math-block, .math-fallback, section[id]'
    );
    const seen = new Set<Element>();

    for (const el of Array.from(elements)) {
      if (seen.has(el)) continue;
      const tag = el.tagName.toLowerCase();

      if (tag === 'section') {
        // Record section anchor on first child heading or emit subtle anchor marker
        const secId = el.getAttribute('id') || undefined;
        const firstH = el.querySelector('h1, h2, h3, h4');
        if (secId && firstH && !firstH.getAttribute('id')) {
          firstH.setAttribute('id', secId);
        }
        continue;
      }

      if (tag === 'p' && (el.closest('blockquote') || el.closest('figure') || el.closest('table'))) {
        continue;
      }
      if (tag === 'p' && el.classList.contains('page-ref')) {
        continue;
      }

      seen.add(el);
      const idAttr = el.getAttribute('id') || el.closest('[id]')?.getAttribute('id') || undefined;

      if (tag === 'figure') {
        const img = el.querySelector('img');
        const src = img?.getAttribute('src') || '';
        const alt = img?.getAttribute('alt') || '';
        const cap = el.querySelector('figcaption')?.textContent?.replace(/\s+/g, ' ').trim() || alt;
        const blobUrl = await resolveImageBlobUrl(zip, chapterDir, src, imageCache, blobUrlsToRevoke);
        if (blobUrl || cap) {
          blocks.push({
            id: idAttr,
            type: 'image',
            text: cap || 'Textbook diagram',
            imageSrc: blobUrl,
            caption: cap,
          });
        }
        continue;
      }

      if (tag === 'table') {
        const headers: string[] = [];
        el.querySelectorAll('thead tr th, tr:first-child th').forEach((th) => {
          headers.push((th.textContent || '').replace(/\s+/g, ' ').trim());
        });
        const rows: string[][] = [];
        const bodyRows = el.querySelectorAll('tbody tr').length > 0
          ? el.querySelectorAll('tbody tr')
          : el.querySelectorAll('tr');
        bodyRows.forEach((tr, rowIdx) => {
          if (headers.length > 0 && rowIdx === 0 && tr.querySelectorAll('th').length > 0 && el.querySelectorAll('thead').length === 0) {
            return;
          }
          const cells = Array.from(tr.querySelectorAll('td, th')).map((c) =>
            (c.textContent || '').replace(/\s+/g, ' ').trim()
          );
          if (cells.some(Boolean)) rows.push(cells);
        });
        if (headers.length > 0 || rows.length > 0) {
          blocks.push({
            id: idAttr,
            type: 'table',
            text: [...headers, ...rows.flat()].join(' '),
            tableData: { headers, rows },
          });
        }
        continue;
      }

      if (el.classList.contains('math-block') || el.classList.contains('math-fallback')) {
        const mathText = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (mathText) {
          blocks.push({
            id: idAttr,
            type: 'math',
            text: mathText,
          });
        }
        continue;
      }

      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text) continue;

      if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
        blocks.push({
          id: idAttr,
          type: 'heading',
          level: Number(tag.slice(1)),
          text,
        });
      } else if (tag === 'blockquote') {
        blocks.push({ id: idAttr, type: 'blockquote', text });
      } else if (tag === 'li') {
        blocks.push({ id: idAttr, type: 'list-item', text });
      } else {
        blocks.push({ id: idAttr, type: 'paragraph', text });
      }
    }

    if (blocks.length === 0) {
      const rawText = (body.textContent || '').replace(/\s+/g, ' ').trim();
      if (rawText) {
        blocks.push({ type: 'paragraph', text: rawText });
      }
    }
  }

  const plainText = blocks.map((b) => b.text).join('\n\n');
  return { title: resolvedTitle, blocks, plainText };
}

export async function parseEpubArrayBuffer(
  buffer: ArrayBuffer,
  fallbackMeta?: { title?: string; author?: string; publisher?: string }
): Promise<ParsedEpubDocument> {
  const zip = await JSZip.loadAsync(buffer);
  const parser = new DOMParser();
  const imageCache = new Map<string, string>();
  const blobUrlsToRevoke: string[] = [];

  let opfPath = 'OEBPS/content.opf';
  const containerEntry = getZipEntry(zip, 'META-INF/container.xml');
  if (containerEntry) {
    const containerXml = await containerEntry.async('text');
    const containerDoc = parser.parseFromString(containerXml, 'application/xml');
    const fullPath = containerDoc.querySelector('rootfile')?.getAttribute('full-path');
    if (fullPath) opfPath = fullPath.trim();
  } else {
    const opfFallback = Object.keys(zip.files).find((f) => f.toLowerCase().endsWith('.opf'));
    if (opfFallback) opfPath = opfFallback;
  }

  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/')) : '';
  const opfEntry = getZipEntry(zip, opfPath);

  if (!opfEntry) {
    const htmlNames = Object.keys(zip.files)
      .filter((n) => /\.(xhtml|html|htm)$/i.test(n) && !n.toLowerCase().includes('nav'))
      .sort();

    const chapters: ParsedEpubChapter[] = [];
    for (let i = 0; i < htmlNames.length; i++) {
      const name = htmlNames[i];
      const raw = await zip.files[name].async('text');
      const extracted = await extractBlocksFromXhtml(
        raw,
        `Chapter ${i + 1}`,
        zip,
        name,
        imageCache,
        blobUrlsToRevoke
      );
      if (extracted.blocks.length > 0) {
        chapters.push({
          id: `ch-${i + 1}`,
          title: extracted.title,
          href: name,
          blocks: extracted.blocks,
          plainText: extracted.plainText,
        });
      }
    }
    return {
      title: fallbackMeta?.title || 'EPUB Textbook',
      author: fallbackMeta?.author || 'Edu AI',
      publisher: fallbackMeta?.publisher,
      toc: chapters.map((c) => ({ label: c.title, href: c.href, level: 1 })),
      chapters,
      blobUrlsToRevoke,
    };
  }

  const opfXml = await opfEntry.async('text');
  const opfDoc = parser.parseFromString(opfXml, 'application/xml');

  const metaTitle =
    opfDoc.querySelector('metadata > title, dc\\:title, title')?.textContent?.trim() ||
    fallbackMeta?.title ||
    'EPUB Textbook';
  const metaAuthor =
    opfDoc.querySelector('metadata > creator, dc\\:creator, creator')?.textContent?.trim() ||
    fallbackMeta?.author ||
    'Edu AI';
  const metaPublisher =
    opfDoc.querySelector('metadata > publisher, dc\\:publisher, publisher')?.textContent?.trim() ||
    fallbackMeta?.publisher;
  const metaLanguage =
    opfDoc.querySelector('metadata > language, dc\\:language, language')?.textContent?.trim() || 'en';

  const manifestMap = new Map<string, { href: string; mediaType: string; properties: string }>();
  opfDoc.querySelectorAll('manifest > item').forEach((item) => {
    const id = item.getAttribute('id') || '';
    const href = item.getAttribute('href') || '';
    const mediaType = item.getAttribute('media-type') || '';
    const properties = item.getAttribute('properties') || '';
    if (id && href) {
      manifestMap.set(id, {
        href: resolveRelativePath(opfDir, href),
        mediaType,
        properties,
      });
    }
  });

  const hrefTitleMap = new Map<string, string>();
  const toc: ParsedEpubTocItem[] = [];
  const navManifest = Array.from(manifestMap.values()).find((m) =>
    m.properties.split(/\s+/).includes('nav')
  );
  if (navManifest) {
    const navEntry = getZipEntry(zip, navManifest.href);
    if (navEntry) {
      const navText = await navEntry.async('text');
      const navDoc = parser.parseFromString(navText, 'text/html');
      const navBase = navManifest.href.includes('/')
        ? navManifest.href.slice(0, navManifest.href.lastIndexOf('/'))
        : '';
      const tocNav = navDoc.querySelector('nav[epub\\:type="toc"], nav#toc, nav');
      const walkNavList = (olEl: Element | null, level: number) => {
        if (!olEl) return;
        Array.from(olEl.children).forEach((li) => {
          const a = li.querySelector(':scope > a[href]');
          if (a) {
            const rawHref = a.getAttribute('href') || '';
            const label = a.textContent?.replace(/\s+/g, ' ').trim() || '';
            const [relPart, anchorPart] = rawHref.split('#');
            const resolvedHref = resolveRelativePath(navBase, relPart || navManifest.href);
            if (label) {
              if (!hrefTitleMap.has(resolvedHref) && level === 1) {
                hrefTitleMap.set(resolvedHref, label);
              }
              toc.push({
                label,
                href: resolvedHref,
                anchor: anchorPart || undefined,
                level,
              });
            }
          }
          const childOl = li.querySelector(':scope > ol');
          if (childOl) walkNavList(childOl, Math.min(3, level + 1));
        });
      };
      if (tocNav) {
        walkNavList(tocNav.querySelector(':scope > ol'), 1);
      }
    }
  }

  const spineRefs: Array<{ id: string; href: string }> = [];
  opfDoc.querySelectorAll('spine > itemref').forEach((ref) => {
    const idref = ref.getAttribute('idref');
    if (!idref) return;
    const item = manifestMap.get(idref);
    if (!item) return;
    if (item.properties.split(/\s+/).includes('nav')) return;
    if (!/xhtml|html/i.test(item.mediaType) && !/\.(xhtml|html|htm)$/i.test(item.href)) return;
    spineRefs.push({ id: idref, href: item.href });
  });

  const chapters: ParsedEpubChapter[] = [];
  for (let i = 0; i < spineRefs.length; i++) {
    const ref = spineRefs[i];
    const entry = getZipEntry(zip, ref.href);
    if (!entry) continue;
    const rawHtml = await entry.async('text');
    const tocLabel = hrefTitleMap.get(ref.href) || `Chapter ${i + 1}`;
    const extracted = await extractBlocksFromXhtml(
      rawHtml,
      tocLabel,
      zip,
      ref.href,
      imageCache,
      blobUrlsToRevoke
    );
    if (extracted.blocks.length === 0) continue;

    chapters.push({
      id: ref.id,
      title: hrefTitleMap.get(ref.href) || extracted.title,
      href: ref.href,
      blocks: extracted.blocks,
      plainText: extracted.plainText,
    });
  }

  return {
    title: metaTitle,
    author: metaAuthor,
    publisher: metaPublisher,
    language: metaLanguage,
    toc:
      toc.length > 0
        ? toc
        : chapters.map((c) => ({ label: c.title, href: c.href, level: 1 })),
    chapters,
    blobUrlsToRevoke,
  };
}
