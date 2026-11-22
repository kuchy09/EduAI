import JSZip from 'jszip';

export interface ParsedEpubChapter {
  id: string;
  title: string;
  href: string;
  blocks: Array<{
    type: 'heading' | 'paragraph' | 'blockquote' | 'list-item';
    level?: number;
    text: string;
  }>;
  plainText: string;
}

export interface ParsedEpubDocument {
  title: string;
  author: string;
  publisher?: string;
  language?: string;
  chapters: ParsedEpubChapter[];
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
  const decoded = decodeURIComponent(pathCandidate);
  const byDecoded = zip.file(decoded);
  if (byDecoded) return byDecoded;
  const lower = decoded.toLowerCase();
  for (const name of Object.keys(zip.files)) {
    if (name.toLowerCase() === lower && !zip.files[name].dir) {
      return zip.files[name];
    }
  }
  return null;
}

function extractBlocksFromXhtml(
  xhtml: string,
  fallbackTitle: string
): { title: string; blocks: ParsedEpubChapter['blocks']; plainText: string } {
  const parser = new DOMParser();
  let doc = parser.parseFromString(xhtml, 'application/xhtml+xml');
  if (doc.querySelector('parsererror')) {
    doc = parser.parseFromString(xhtml, 'text/html');
  }

  // Strip scripts, styles, and unsafe elements
  doc.querySelectorAll('script, style, iframe, object, embed').forEach((el) => el.remove());

  const titleFromHead = doc.querySelector('head > title')?.textContent?.trim();
  const firstHeading = doc.querySelector('h1, h2')?.textContent?.trim();
  const resolvedTitle = firstHeading || titleFromHead || fallbackTitle;

  const blocks: ParsedEpubChapter['blocks'] = [];
  const body = doc.body || doc.documentElement;

  if (body) {
    const elements = body.querySelectorAll('h1, h2, h3, h4, p, blockquote, li');
    const seen = new Set<Element>();

    elements.forEach((el) => {
      if (seen.has(el)) return;
      // Avoid duplicating <p> inside <blockquote>
      if (el.tagName.toLowerCase() === 'p' && el.closest('blockquote')) {
        return;
      }
      seen.add(el);
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text) return;

      const tag = el.tagName.toLowerCase();
      if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
        blocks.push({
          type: 'heading',
          level: Number(tag.slice(1)),
          text,
        });
      } else if (tag === 'blockquote') {
        blocks.push({ type: 'blockquote', text });
      } else if (tag === 'li') {
        blocks.push({ type: 'list-item', text });
      } else {
        blocks.push({ type: 'paragraph', text });
      }
    });

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

  // 1. Locate rootfile from META-INF/container.xml
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
    // Fallback: parse any xhtml/html files in spine alphabetical order
    const htmlNames = Object.keys(zip.files)
      .filter((n) => /\.(xhtml|html|htm)$/i.test(n) && !n.toLowerCase().includes('nav'))
      .sort();

    const chapters: ParsedEpubChapter[] = [];
    for (let i = 0; i < htmlNames.length; i++) {
      const name = htmlNames[i];
      const raw = await zip.files[name].async('text');
      const extracted = extractBlocksFromXhtml(raw, `Chapter ${i + 1}`);
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
      chapters,
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

  // 2. Build manifest map (id -> { href, mediaType, properties })
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

  // 3. Parse nav or NCX labels for cleaner chapter titles
  const hrefTitleMap = new Map<string, string>();
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
      navDoc.querySelectorAll('nav a[href]').forEach((a) => {
        const href = a.getAttribute('href') || '';
        const label = a.textContent?.replace(/\s+/g, ' ').trim();
        if (href && label) {
          hrefTitleMap.set(resolveRelativePath(navBase, href), label);
        }
      });
    }
  }

  // 4. Walk spine in reading order
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
    const extracted = extractBlocksFromXhtml(rawHtml, tocLabel);
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
    chapters,
  };
}
