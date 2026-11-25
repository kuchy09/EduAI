export interface NormalizedCoverUrlResult {
  url: string;
  wasUnwrapped: boolean;
  isWebPageHint: boolean;
  isValidSyntax: boolean;
  error?: string;
}

const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|avif|bmp|svg)(?:$|[?#])/i;

function isSafeDataImageUrl(val: string): boolean {
  return /^data:image\/(png|jpe?g|webp|gif|avif|bmp|svg\+xml);/i.test(val);
}

/**
 * Cleans and unwraps pasted cover image URLs from address bars, Google Images links,
 * Unsplash/Pexels pages, etc., while rejecting unsafe schemes (javascript:, file:, blob:).
 */
export function normalizePastedCoverUrl(rawInput: string): NormalizedCoverUrlResult {
  let cleaned = String(rawInput || '').trim();

  // Strip surrounding quotes or angle brackets often copied from CSS/Markdown/HTML
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'")) ||
    (cleaned.startsWith('<') && cleaned.endsWith('>'))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  if (!cleaned) {
    return { url: '', wasUnwrapped: false, isWebPageHint: false, isValidSyntax: true };
  }

  // Block dangerous schemes immediately
  const lower = cleaned.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:') ||
    lower.startsWith('blob:')
  ) {
    return {
      url: '',
      wasUnwrapped: false,
      isWebPageHint: false,
      isValidSyntax: false,
      error: 'Unsupported or temporary URL scheme. Paste a public http(s):// image URL or upload an image file.',
    };
  }

  if (lower.startsWith('data:')) {
    if (!isSafeDataImageUrl(cleaned)) {
      return {
        url: '',
        wasUnwrapped: false,
        isWebPageHint: false,
        isValidSyntax: false,
        error: 'Only image data URLs (PNG, JPEG, WebP, GIF, AVIF, SVG) are supported.',
      };
    }
    return { url: cleaned, wasUnwrapped: false, isWebPageHint: false, isValidSyntax: true };
  }

  // Relative app routes (/api/download?key=...)
  if (cleaned.startsWith('/')) {
    return { url: cleaned, wasUnwrapped: false, isWebPageHint: false, isValidSyntax: true };
  }

  // Auto-prepend https:// if user pasted a domain URL without protocol
  if (!/^https?:\/\//i.test(cleaned) && /^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(cleaned);
  } catch {
    return {
      url: cleaned,
      wasUnwrapped: false,
      isWebPageHint: false,
      isValidSyntax: false,
      error: 'Enter a valid http(s):// URL or /api/download path.',
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      url: '',
      wasUnwrapped: false,
      isWebPageHint: false,
      isValidSyntax: false,
      error: 'Only http:// and https:// image links are supported.',
    };
  }

  let wasUnwrapped = false;
  const host = parsed.hostname.toLowerCase();

  // Unwrap Google Images search result URLs: https://www.google.com/imgres?imgurl=...
  if (host.includes('google.') && parsed.pathname === '/imgres') {
    const imgurl = parsed.searchParams.get('imgurl');
    if (imgurl && /^https?:\/\//i.test(imgurl)) {
      cleaned = imgurl.trim();
      wasUnwrapped = true;
      try {
        parsed = new URL(cleaned);
      } catch {}
    }
  } else if (host.includes('google.') && parsed.pathname === '/url') {
    const target = parsed.searchParams.get('url') || parsed.searchParams.get('q');
    if (target && /^https?:\/\//i.test(target)) {
      cleaned = target.trim();
      wasUnwrapped = true;
      try {
        parsed = new URL(cleaned);
      } catch {}
    }
  } else if ((host.includes('bing.com') || host.includes('duckduckgo.com')) && parsed.searchParams.get('mediaurl')) {
    const target = parsed.searchParams.get('mediaurl');
    if (target && /^https?:\/\//i.test(target)) {
      cleaned = target.trim();
      wasUnwrapped = true;
      try {
        parsed = new URL(cleaned);
      } catch {}
    }
  }

  const finalHost = parsed.hostname.toLowerCase();
  const isWebPageHint =
    (finalHost === 'unsplash.com' || finalHost === 'www.unsplash.com') &&
    parsed.pathname.startsWith('/photos/') ||
    (finalHost.includes('pexels.com') && parsed.pathname.startsWith('/photo/')) ||
    (finalHost.includes('pinterest.') && parsed.pathname.startsWith('/pin/')) ||
    (finalHost.includes('amazon.') && parsed.pathname.includes('/dp/')) ||
    (!IMAGE_EXT_RE.test(parsed.pathname) &&
      !finalHost.includes('images.unsplash.com') &&
      !finalHost.includes('googleusercontent.com') &&
      !finalHost.includes('books.google.') &&
      !parsed.pathname.includes('/api/download'));

  return {
    url: cleaned,
    wasUnwrapped,
    isWebPageHint,
    isValidSyntax: true,
  };
}

export function isDirectSafeCoverImageSrc(url?: string): boolean {
  const trimmed = String(url || '').trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/')) return true;
  if (isSafeDataImageUrl(trimmed)) return true;
  return /^https?:\/\//i.test(trimmed);
}
