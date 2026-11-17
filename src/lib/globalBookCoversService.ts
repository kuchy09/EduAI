import { Book } from '../types';
import { safeStorage } from './safeStorage';
import { getPersistedDeviceSession } from './supabase';
import {
  BookCoverOverride,
  CANONICAL_BOOK_COVERS,
  applyGlobalBookCover,
  applyGlobalBookCoversToList,
  mergeGlobalBookCoversMaps,
  normalizeBookCoverTitleKey,
} from '../../shared/canonicalBookCovers';

export type { BookCoverOverride };

export const GLOBAL_BOOK_COVERS_STORAGE_KEY = 'edu_ai_global_book_covers_v1';
export const GLOBAL_BOOK_COVERS_EVENT = 'eduai_global_book_covers_updated';

let inMemoryGlobalCovers: Record<string, BookCoverOverride> | null = null;
let inFlightFetch: Promise<Record<string, BookCoverOverride>> | null = null;

function dispatchGlobalCoversEvent(covers: Record<string, BookCoverOverride>) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent(GLOBAL_BOOK_COVERS_EVENT, { detail: { covers } })
    );
  } catch (_) {}
}

export function getGlobalBookCovers(): Record<string, BookCoverOverride> {
  if (inMemoryGlobalCovers) {
    return inMemoryGlobalCovers;
  }
  const stored = safeStorage.getJSON<Record<string, BookCoverOverride>>(
    GLOBAL_BOOK_COVERS_STORAGE_KEY,
    {}
  );
  const merged = mergeGlobalBookCoversMaps(CANONICAL_BOOK_COVERS, stored);
  inMemoryGlobalCovers = merged;
  return merged;
}

export function setGlobalBookCovers(
  incoming: Record<string, BookCoverOverride>,
  options?: { notify?: boolean }
): Record<string, BookCoverOverride> {
  const current = getGlobalBookCovers();
  const merged = mergeGlobalBookCoversMaps(CANONICAL_BOOK_COVERS, current, incoming);
  inMemoryGlobalCovers = merged;
  try {
    safeStorage.setJSON(GLOBAL_BOOK_COVERS_STORAGE_KEY, merged);
  } catch (_) {}
  if (options?.notify !== false) {
    dispatchGlobalCoversEvent(merged);
  }
  return merged;
}

export function applyGlobalCoversToBooks<T extends Book>(books: T[]): T[] {
  const covers = getGlobalBookCovers();
  return applyGlobalBookCoversToList(books, covers);
}

export function applyGlobalCoverToBook<T extends Book>(book: T): T {
  const covers = getGlobalBookCovers();
  return applyGlobalBookCover(book, covers);
}

export async function fetchGlobalBookCoversFromServer(): Promise<Record<string, BookCoverOverride>> {
  if (inFlightFetch) return inFlightFetch;
  inFlightFetch = (async () => {
    try {
      const res = await fetch('/api/book-covers', {
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.covers && typeof data.covers === 'object') {
          return setGlobalBookCovers(data.covers);
        }
      }
    } catch (err) {
      console.warn('[GlobalBookCovers] Fetch notice:', err);
    }
    return getGlobalBookCovers();
  })();

  try {
    return await inFlightFetch;
  } finally {
    inFlightFetch = null;
  }
}

export async function saveGlobalBookCover(
  bookId: string,
  override: BookCoverOverride,
  bookMeta?: Partial<Book>,
  explicitToken?: string
): Promise<Record<string, BookCoverOverride>> {
  const titleKey = override.titleKey || normalizeBookCoverTitleKey(bookMeta?.title);
  const entry: BookCoverOverride = {
    ...override,
    ...(titleKey ? { titleKey } : {}),
    updatedAt: override.updatedAt || new Date().toISOString(),
  };

  const next = setGlobalBookCovers({ [bookId]: entry });
  const token = explicitToken || getPersistedDeviceSession()?.access_token;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // Persist to system-wide global cover registry & catalog on backend + Supabase
  try {
    const coverRes = await fetch(`/api/book-covers/${encodeURIComponent(bookId)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        override: entry,
        bookMeta: bookMeta
          ? {
              id: bookId,
              title: bookMeta.title,
              author: bookMeta.author,
              publisher: bookMeta.publisher,
              category: bookMeta.category,
              description: bookMeta.description,
              level: bookMeta.level,
              curriculum: bookMeta.curriculum,
              subjects: bookMeta.subjects,
              country: bookMeta.country,
              fileUrl: bookMeta.fileUrl,
              isbn: bookMeta.isbn,
              isKicdApproved: bookMeta.isKicdApproved,
            }
          : undefined,
      }),
    });
    if (coverRes.ok) {
      const payload = await coverRes.json().catch(() => null);
      if (payload?.covers && typeof payload.covers === 'object') {
        return setGlobalBookCovers(payload.covers);
      }
    }
  } catch (err) {
    console.warn('[GlobalBookCovers] PUT /api/book-covers warning:', err);
  }

  return next;
}
