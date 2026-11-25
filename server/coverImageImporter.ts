import dns from "dns";
import net from "net";
import crypto from "crypto";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_HTML_PEEK_BYTES = 256 * 1024; // 256 KB for og:image extraction
const MAX_REDIRECTS = 4;
const REQUEST_TIMEOUT_MS = 12000;

export interface ImportedCoverImageResult {
  buffer: Buffer;
  contentType: string;
  extension: string;
  resolvedUrl: string;
  sha256: string;
}

function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return -1;
  }
  return (((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0;
}

function isDisallowedIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n < 0) return true;
  const inRange = (start: string, end: string) => {
    const s = ipv4ToInt(start);
    const e = ipv4ToInt(end);
    return n >= s && n <= e;
  };
  return (
    inRange("0.0.0.0", "0.255.255.255") || // Current network / unspecified
    inRange("10.0.0.0", "10.255.255.255") || // RFC1918 private
    inRange("100.64.0.0", "100.127.255.255") || // CGNAT
    inRange("127.0.0.0", "127.255.255.255") || // Loopback
    inRange("169.254.0.0", "169.254.255.255") || // Link-local & cloud metadata (169.254.169.254)
    inRange("172.16.0.0", "172.31.255.255") || // RFC1918 private
    inRange("192.0.0.0", "192.0.0.255") || // IETF protocol assignments
    inRange("192.0.2.0", "192.0.2.255") || // TEST-NET-1
    inRange("192.168.0.0", "192.168.255.255") || // RFC1918 private
    inRange("198.18.0.0", "198.19.255.255") || // Benchmarking
    inRange("224.0.0.0", "255.255.255.255") // Multicast / reserved / broadcast
  );
}

function isDisallowedIp(rawIp: string): boolean {
  const ip = String(rawIp || "").trim().replace(/^\[|\]$/g, "").split("%")[0].toLowerCase();
  const kind = net.isIP(ip);
  if (kind === 4) {
    return isDisallowedIpv4(ip);
  }
  if (kind === 6) {
    if (ip === "::" || ip === "::1") return true;
    // IPv4-mapped IPv6 addresses (::ffff:127.0.0.1 or ::ffff:7f00:1)
    if (ip.startsWith("::ffff:")) {
      const mapped = ip.slice("::ffff:".length);
      if (net.isIP(mapped) === 4) return isDisallowedIpv4(mapped);
      const hexParts = mapped.split(":");
      if (hexParts.length === 2) {
        const hi = parseInt(hexParts[0], 16);
        const lo = parseInt(hexParts[1], 16);
        if (!Number.isNaN(hi) && !Number.isNaN(lo)) {
          const v4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
          return isDisallowedIpv4(v4);
        }
      }
      return true;
    }
    // Unique local (fc00::/7) and link-local (fe80::/10) & multicast (ff00::/8)
    const firstHextet = parseInt(ip.split(":")[0] || "0", 16);
    if (!Number.isNaN(firstHextet)) {
      if ((firstHextet & 0xfe00) === 0xfc00) return true; // fc00::/7
      if ((firstHextet & 0xffc0) === 0xfe80) return true; // fe80::/10
      if ((firstHextet & 0xff00) === 0xff00) return true; // ff00::/8
    }
    return false;
  }
  return true;
}

async function assertSafePublicHttpUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(String(rawUrl || "").trim());
  } catch {
    throw new Error("Invalid URL format. Please paste a full https:// image link.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http:// and https:// URLs are permitted.");
  }

  if (parsed.username || parsed.password) {
    throw new Error("URLs containing embedded credentials are not permitted.");
  }

  if (parsed.port && parsed.port !== "80" && parsed.port !== "443") {
    throw new Error("Non-standard URL ports are not permitted for cover imports.");
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".lan") ||
    hostname === "metadata" ||
    hostname === "metadata.goog" ||
    hostname === "metadata.google.internal"
  ) {
    throw new Error("Local or internal hostnames cannot be imported.");
  }

  if (net.isIP(hostname) !== 0) {
    if (isDisallowedIp(hostname)) {
      throw new Error("Private, loopback, or link-local IP addresses are not permitted.");
    }
    return parsed;
  }

  let addresses: dns.LookupAddress[];
  try {
    addresses = await dns.promises.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error(`Could not resolve hostname "${hostname}". Check the URL and try again.`);
  }

  if (!addresses || addresses.length === 0) {
    throw new Error(`No network address found for "${hostname}".`);
  }

  for (const addr of addresses) {
    if (isDisallowedIp(addr.address)) {
      throw new Error(`Resolved address for "${hostname}" is not a public internet endpoint.`);
    }
  }

  return parsed;
}

function detectRasterImageFormat(buf: Buffer): { contentType: string; extension: string } | null {
  if (!buf || buf.length < 12) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { contentType: "image/png", extension: "png" };
  }
  // GIF: GIF87a / GIF89a
  const ascii6 = buf.subarray(0, 6).toString("ascii");
  if (ascii6 === "GIF87a" || ascii6 === "GIF89a") {
    return { contentType: "image/gif", extension: "gif" };
  }
  // WebP: RIFF....WEBP
  if (
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { contentType: "image/webp", extension: "webp" };
  }
  // BMP: BM
  if (buf[0] === 0x42 && buf[1] === 0x4d) {
    return { contentType: "image/bmp", extension: "bmp" };
  }
  // AVIF / HEIF ISO BMFF: ....ftypavif / ....ftypavis
  if (buf.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buf.subarray(8, 12).toString("ascii");
    if (brand === "avif" || brand === "avis") {
      return { contentType: "image/avif", extension: "avif" };
    }
  }

  return null;
}

async function readResponseWithLimit(res: Response, maxBytes: number): Promise<Buffer> {
  const declaredLength = Number(res.headers.get("content-length") || 0);
  if (declaredLength > maxBytes) {
    throw new Error(`Remote file is too large (${Math.round(declaredLength / 1024 / 1024)} MB). Max allowed is 8 MB.`);
  }
  if (!res.body) {
    const arr = await res.arrayBuffer();
    if (arr.byteLength > maxBytes) {
      throw new Error("Remote image exceeds maximum 8 MB limit.");
    }
    return Buffer.from(arr);
  }

  const reader = res.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new Error("Remote image exceeds maximum 8 MB limit.");
      }
      chunks.push(Buffer.from(value));
    }
  }
  return Buffer.concat(chunks);
}

function decodeBasicHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&#x26;/gi, "&")
    .replace(/&#38;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function extractOgImageUrlFromHtml(html: string, baseUrl: string): string | null {
  const metaTagMatches = html.match(/<meta\b[^>]{1,600}>/gi) || [];
  const preferredKeys = ["og:image:secure_url", "og:image", "twitter:image:src", "twitter:image"];

  for (const key of preferredKeys) {
    for (const tag of metaTagMatches) {
      const propMatch = tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i);
      if (!propMatch || propMatch[1].toLowerCase() !== key) continue;
      const contentMatch = tag.match(/\bcontent\s*=\s*["']([^"']+)["']/i);
      if (!contentMatch || !contentMatch[1].trim()) continue;
      try {
        return new URL(decodeBasicHtmlEntities(contentMatch[1].trim()), baseUrl).toString();
      } catch {}
    }
  }

  const linkMatch = html.match(/<link\b[^>]*rel\s*=\s*["']image_src["'][^>]*href\s*=\s*["']([^"']+)["'][^>]*>/i);
  if (linkMatch?.[1]) {
    try {
      return new URL(decodeBasicHtmlEntities(linkMatch[1].trim()), baseUrl).toString();
    } catch {}
  }

  return null;
}

export async function fetchAndValidateRemoteCoverImage(
  rawUrl: string,
  depth = 0
): Promise<ImportedCoverImageResult> {
  let currentUrl = (await assertSafePublicHttpUrl(rawUrl)).toString();
  let finalResponse: Response | null = null;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const validated = await assertSafePublicHttpUrl(currentUrl);
    const res = await fetch(validated.toString(), {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; EduAI-CoverImporter/1.0; +https://eduai.local)",
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.9,text/html;q=0.5,*/*;q=0.4",
      },
    });

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      await res.body?.cancel().catch(() => {});
      if (!loc) {
        throw new Error(`Remote server returned redirect (${res.status}) with no destination.`);
      }
      if (hop >= MAX_REDIRECTS) {
        throw new Error("Too many redirects while fetching cover image URL.");
      }
      currentUrl = new URL(loc, validated).toString();
      continue;
    }

    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      throw new Error(`Remote server returned HTTP ${res.status} (${res.statusText || "Error"}).`);
    }

    finalResponse = res;
    break;
  }

  if (!finalResponse) {
    throw new Error("Failed to fetch remote cover image.");
  }

  const headerMime = String(finalResponse.headers.get("content-type") || "")
    .split(";")[0]
    .trim()
    .toLowerCase();

  // If user pasted an HTML webpage URL (e.g. unsplash.com/photos/... or publisher book page),
  // safely peek for og:image / twitter:image metadata once.
  if ((headerMime === "text/html" || headerMime === "application/xhtml+xml") && depth === 0) {
    const htmlBuf = await readResponseWithLimit(finalResponse, MAX_HTML_PEEK_BYTES);
    const htmlText = htmlBuf.toString("utf-8");
    const extracted = extractOgImageUrlFromHtml(htmlText, currentUrl);
    if (!extracted) {
      throw new Error(
        "The pasted link points to a webpage without a readable cover image (og:image). Copy the direct image address instead."
      );
    }
    return fetchAndValidateRemoteCoverImage(extracted, depth + 1);
  }

  const buffer = await readResponseWithLimit(finalResponse, MAX_IMAGE_BYTES);
  const detected = detectRasterImageFormat(buffer);
  if (!detected) {
    if (headerMime === "image/svg+xml") {
      throw new Error("Remote SVG URLs cannot be auto-imported; upload an SVG file directly or paste a PNG/JPG/WebP image URL.");
    }
    throw new Error(
      `URL did not return a valid raster image (received ${headerMime || "unknown content"}). Right-click the image and choose "Copy Image Address".`
    );
  }

  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16);
  return {
    buffer,
    contentType: detected.contentType,
    extension: detected.extension,
    resolvedUrl: currentUrl,
    sha256,
  };
}
