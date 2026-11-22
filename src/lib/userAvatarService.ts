import { useState, useEffect } from 'react';
import { getSupabaseClient, getPersistedDeviceSession, supabase } from './supabase';
import { safeStorage } from './safeStorage';
import { ACCOUNT_SYNC_EVENT, pushAccountSyncPatch } from './accountSyncService';

// Tracks URLs that failed <img> loading in the current session so components
// automatically advance to secondary/fallback sources instead of rendering broken images.
const failedAvatarUrls = new Set<string>();
const fetchedServerAvatarForUser = new Set<string>();

function isMockAvatarUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.includes('photo-1534528741775-53994a69daeb');
}

function normalizeUrlForComparison(url: string): string {
  return url.trim();
}

export function isAvatarUrlFailed(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = normalizeUrlForComparison(url);
  if (!trimmed) return false;
  if (failedAvatarUrls.has(trimmed)) return true;
  // Also match encoded/raw /api/download key variants
  if (trimmed.includes('/api/download')) {
    try {
      const parsed = new URL(trimmed, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
      const key = parsed.searchParams.get('key');
      if (key && (failedAvatarUrls.has(key) || failedAvatarUrls.has(key.replace(/^uploads\/+/, '')))) {
        return true;
      }
    } catch (_) {}
  }
  return false;
}

export function getPublicAvatarUrl(keyOrUrl: string | null | undefined): string | null {
  if (!keyOrUrl || typeof keyOrUrl !== 'string') return null;
  const trimmed = keyOrUrl.trim();
  if (!trimmed || isMockAvatarUrl(trimmed)) return null;
  let resolved: string;
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('/api/download')
  ) {
    resolved = trimmed;
  } else {
    resolved = `/api/download?key=${encodeURIComponent(trimmed)}&inline=true`;
  }
  if (isAvatarUrlFailed(resolved) || isAvatarUrlFailed(trimmed)) {
    return null;
  }
  return resolved;
}

function getScopedKeys(userId?: string) {
  return {
    dataUrlKey: userId ? `user_avatar_data_url_${userId}` : 'user_avatar_data_url',
    customUrlKey: userId ? `user_custom_avatar_${userId}` : 'user_custom_avatar',
    avatarKey: userId ? `user_profile_avatar_key_${userId}` : 'user_profile_avatar_key',
  };
}

export function getAvatarCandidates(user?: any, profile?: any): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();

  const pushCandidate = (raw?: string | null) => {
    const resolved = getPublicAvatarUrl(raw);
    if (resolved && !seen.has(resolved)) {
      seen.add(resolved);
      candidates.push(resolved);
    }
  };

  try {
    const userId = user?.id || profile?.id;

    // 1. Live cloud/profile avatar URL (when valid and not failed)
    pushCandidate(profile?.avatar_url);

    // 2. User-scoped storage keys (including local data URL backup)
    if (userId) {
      const scoped = getScopedKeys(userId);
      const scopedUrl = safeStorage.getItem(scoped.customUrlKey);
      if (scopedUrl && !isMockAvatarUrl(scopedUrl)) {
        pushCandidate(scopedUrl);
      }
      const scopedKey = safeStorage.getItem(scoped.avatarKey);
      if (scopedKey && !isMockAvatarUrl(scopedKey)) {
        pushCandidate(scopedKey);
      }
      const scopedData = safeStorage.getItem(scoped.dataUrlKey);
      if (
        scopedData &&
        (scopedData.startsWith('data:image') || scopedData.startsWith('blob:') || scopedData.startsWith('http'))
      ) {
        pushCandidate(scopedData);
      }
    }

    // 3. User auth metadata fields (supports OAuth picture, profile_photo_key, avatar_url)
    pushCandidate(user?.user_metadata?.avatar_url);
    pushCandidate(user?.user_metadata?.profile_photo_key);
    pushCandidate(user?.user_metadata?.picture);

    // 4. Legacy unscoped keys as final backup when no userId or when userId has no other working source
    const directDataUrl = safeStorage.getItem('user_avatar_data_url');
    if (directDataUrl && (directDataUrl.startsWith('data:image') || directDataUrl.startsWith('http'))) {
      if (!userId || candidates.length === 0) {
        pushCandidate(directDataUrl);
      }
    }
    if (!userId) {
      const cachedUrl = safeStorage.getItem('user_custom_avatar');
      if (cachedUrl && !isMockAvatarUrl(cachedUrl)) {
        pushCandidate(cachedUrl);
      }
      const cachedKey = safeStorage.getItem('user_profile_avatar_key');
      if (cachedKey && !isMockAvatarUrl(cachedKey)) {
        pushCandidate(cachedKey);
      }
    }
  } catch (err) {
    console.warn('[userAvatarService] Error collecting avatar candidates:', err);
  }

  return candidates;
}

export function getStoredUserAvatar(user?: any, profile?: any): string | null {
  const candidates = getAvatarCandidates(user, profile);
  return candidates.length > 0 ? candidates[0] : null;
}

export function markAvatarUrlFailed(
  failedUrl: string | null | undefined,
  user?: any,
  profile?: any
): string | null {
  if (failedUrl && typeof failedUrl === 'string') {
    const trimmed = normalizeUrlForComparison(failedUrl);
    if (trimmed) {
      failedAvatarUrls.add(trimmed);
      if (trimmed.includes('/api/download')) {
        try {
          const parsed = new URL(trimmed, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
          const key = parsed.searchParams.get('key');
          if (key) {
            failedAvatarUrls.add(key);
            failedAvatarUrls.add(key.replace(/^uploads\/+/, ''));
          }
        } catch (_) {}
      }
    }
  }

  const userId = user?.id || profile?.id || getPersistedDeviceSession()?.user?.id;
  if (userId) {
    const scoped = getScopedKeys(userId);
    const curUrl = safeStorage.getItem(scoped.customUrlKey);
    if (curUrl && isAvatarUrlFailed(curUrl)) {
      safeStorage.removeItem(scoped.customUrlKey);
    }
    const curKey = safeStorage.getItem(scoped.avatarKey);
    if (curKey && (isAvatarUrlFailed(curKey) || isAvatarUrlFailed(getPublicAvatarUrl(curKey)))) {
      safeStorage.removeItem(scoped.avatarKey);
    }
  }

  const nextCandidate = getStoredUserAvatar(user, profile);
  if (typeof window !== 'undefined') {
    queueMicrotask(() => {
      window.dispatchEvent(
        new CustomEvent('user_avatar_changed', {
          detail: { avatarUrl: nextCandidate, userId },
        })
      );
    });
  }
  return nextCandidate;
}

export function saveUserAvatarLocally(keyOrUrl: string, directDataUrl?: string, userId?: string) {
  try {
    const activeUserId = userId || getPersistedDeviceSession()?.user?.id;
    const scoped = getScopedKeys(activeUserId);

    const hasFreshDataUrl =
      !!directDataUrl && (directDataUrl.startsWith('data:image') || directDataUrl.startsWith('blob:'));

    if (hasFreshDataUrl && directDataUrl) {
      failedAvatarUrls.delete(directDataUrl.trim());
    }
    if (keyOrUrl) {
      const trimmedKey = keyOrUrl.trim();
      if (hasFreshDataUrl || trimmedKey.startsWith('data:image') || trimmedKey.startsWith('blob:')) {
        failedAvatarUrls.delete(trimmedKey);
      } else if (isAvatarUrlFailed(trimmedKey) || isAvatarUrlFailed(getPublicAvatarUrl(trimmedKey))) {
        return;
      }
    }

    const formattedUrl = directDataUrl || getPublicAvatarUrl(keyOrUrl);
    if (!formattedUrl) return;

    if (directDataUrl && (directDataUrl.startsWith('data:image') || directDataUrl.startsWith('blob:'))) {
      try {
        safeStorage.setItem(scoped.dataUrlKey, directDataUrl);
      } catch (_) {}
    } else if (keyOrUrl.startsWith('data:image') || keyOrUrl.startsWith('blob:')) {
      try {
        safeStorage.setItem(scoped.dataUrlKey, keyOrUrl);
      } catch (_) {}
    }

    const remoteUrl = getPublicAvatarUrl(keyOrUrl);
    safeStorage.setItem(scoped.customUrlKey, remoteUrl || formattedUrl);
    safeStorage.setItem(scoped.avatarKey, keyOrUrl);

    if (typeof window !== 'undefined') {
      queueMicrotask(() => {
        window.dispatchEvent(
          new CustomEvent('user_avatar_changed', {
            detail: { avatarUrl: remoteUrl || formattedUrl, key: keyOrUrl, userId: activeUserId },
          })
        );
        window.dispatchEvent(new Event('storage'));
      });
    }
  } catch (err) {
    console.warn('[userAvatarService] Error saving avatar locally:', err);
  }
}

export function removeUserAvatarLocally(userId?: string) {
  try {
    const activeUserId = userId || getPersistedDeviceSession()?.user?.id;
    if (activeUserId) {
      const scoped = getScopedKeys(activeUserId);
      safeStorage.removeItem(scoped.dataUrlKey);
      safeStorage.removeItem(scoped.customUrlKey);
      safeStorage.removeItem(scoped.avatarKey);
    }
    safeStorage.removeItem('user_avatar_data_url');
    safeStorage.removeItem('user_custom_avatar');
    safeStorage.removeItem('user_profile_avatar_key');

    if (typeof window !== 'undefined') {
      queueMicrotask(() => {
        window.dispatchEvent(
          new CustomEvent('user_avatar_changed', {
            detail: { avatarUrl: null, key: null, userId: activeUserId },
          })
        );
        window.dispatchEvent(new Event('storage'));
      });
    }
  } catch (err) {
    console.warn('[userAvatarService] Error removing avatar locally:', err);
  }
}

async function compressImageToDataUrl(file: File, maxDim = 320): Promise<string | null> {
  if (typeof document === 'undefined') return null;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch (_) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = String(reader.result || '');
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

/**
 * Upload profile picture durably to Supabase Storage ('avatars' bucket) + server disk/B2,
 * with a portable compact JPEG fallback so profile photos persist across restarts & devices.
 */
export async function uploadAndSyncUserAvatar(
  file: File,
  user: any,
  explicitToken?: string
): Promise<string | null> {
  const userId = user?.id;
  failedAvatarUrls.clear();

  let previewDataUrl = '';
  try {
    previewDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  } catch (_) {}

  const compactDataUrl = await compressImageToDataUrl(file, 320);
  const localBestDataUrl = compactDataUrl || previewDataUrl;

  if (localBestDataUrl) {
    saveUserAvatarLocally(localBestDataUrl, localBestDataUrl, userId);
  }

  const sbClient = getSupabaseClient() || supabase;
  let token = explicitToken || '';
  if (!token && sbClient) {
    try {
      const { data } = await sbClient.auth.getSession();
      token = data?.session?.access_token || '';
    } catch (_) {}
  }
  if (!token) {
    token = getPersistedDeviceSession()?.access_token || '';
  }

  let permanentUrl: string | null = null;

  // 1. Primary path: server-side durable upload + Supabase Storage + Postgres profiles + sync
  if (token && userId && localBestDataUrl) {
    try {
      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          dataUrl: localBestDataUrl,
          filename: file.name,
        }),
      });
      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        const resolvedServerUrl = json?.avatarUrl || json?.avatar_url;
        if (resolvedServerUrl && typeof resolvedServerUrl === 'string') {
          permanentUrl = resolvedServerUrl;
        }
      }
    } catch (err) {
      console.warn('[userAvatarService] /api/profile/avatar notice:', err);
    }
  }

  // 2. Client Supabase Storage fallback if server endpoint wasn't used or didn't return a URL
  if (!permanentUrl && sbClient && userId) {
    try {
      const ext = (file.name.split('.').pop() || 'png').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'png';
      const storagePath = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error: uploadErr } = await sbClient.storage
        .from('avatars')
        .upload(storagePath, file, { contentType: file.type || 'image/png', upsert: true });
      if (!uploadErr) {
        const { data: pubData } = sbClient.storage.from('avatars').getPublicUrl(storagePath);
        if (pubData?.publicUrl) {
          permanentUrl = pubData.publicUrl;
        }
      }
    } catch (sbStorageErr) {
      console.warn('[userAvatarService] Supabase avatars bucket upload notice:', sbStorageErr);
    }
  }

  // 3. Fallback to compact portable data URL (never vanishes across container restarts)
  if (!permanentUrl) {
    permanentUrl = localBestDataUrl || null;
  }

  if (permanentUrl && userId) {
    saveUserAvatarLocally(permanentUrl, localBestDataUrl || undefined, userId);

    if (sbClient) {
      if (!permanentUrl.startsWith('data:') && permanentUrl.length < 512) {
        try {
          await sbClient.auth.updateUser({
            data: { avatar_url: permanentUrl, profile_photo_key: permanentUrl },
          });
        } catch (_) {}
      }

      try {
        await sbClient
          .from('profiles')
          .upsert(
            {
              id: userId,
              avatar_url: permanentUrl,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' }
          );
      } catch (_) {}
    }

    if (token) {
      try {
        await fetch('/api/auth/preferences', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ avatar_url: permanentUrl }),
        });
      } catch (_) {}
    }

    pushAccountSyncPatch(
      userId,
      { profileSnapshot: { avatar_url: permanentUrl, updated_at: new Date().toISOString() } },
      token,
      { immediate: true }
    );

    if (typeof window !== 'undefined') {
      queueMicrotask(() => {
        window.dispatchEvent(
          new CustomEvent(ACCOUNT_SYNC_EVENT, {
            detail: { userId, profile: { avatar_url: permanentUrl } },
          })
        );
      });
    }
  }

  return permanentUrl;
}

export function useUserAvatar(user?: any, profile?: any): string | null {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => getStoredUserAvatar(user, profile));

  useEffect(() => {
    let isMounted = true;
    const userId = user?.id || profile?.id;

    // 1. Immediate resolution from non-failed profile / scoped storage / metadata candidates
    const current = getStoredUserAvatar(user, profile);
    if (isMounted) {
      setAvatarUrl(current);
    }

    // Cache valid profile.avatar_url to user-scoped storage when not failed
    if (profile?.avatar_url && !isMockAvatarUrl(profile.avatar_url) && userId) {
      const resolved = getPublicAvatarUrl(profile.avatar_url);
      if (resolved) {
        const scoped = getScopedKeys(userId);
        safeStorage.setItem(scoped.customUrlKey, resolved);
        safeStorage.setItem(scoped.avatarKey, profile.avatar_url);
        if (profile.avatar_url.startsWith('data:image')) {
          safeStorage.setItem(scoped.dataUrlKey, profile.avatar_url);
        }
        if (isMounted) setAvatarUrl(resolved);
      }
    }

    // 2. Fetch latest avatar from Supabase profiles table (when client SDK configured)
    //    or via backend /api/auth/user (in server-proxied auth mode)
    const sbClient = getSupabaseClient() || supabase;
    if (sbClient && userId) {
      const fetchProfileAvatar = async () => {
        try {
          const { data, error } = await sbClient
            .from('profiles')
            .select('avatar_url')
            .eq('id', userId)
            .maybeSingle();

          if (!error && data?.avatar_url && !isMockAvatarUrl(data.avatar_url) && isMounted) {
            const resolved = getPublicAvatarUrl(data.avatar_url);
            if (resolved) {
              const scoped = getScopedKeys(userId);
              safeStorage.setItem(scoped.customUrlKey, resolved);
              safeStorage.setItem(scoped.avatarKey, data.avatar_url);
              if (data.avatar_url.startsWith('data:image')) {
                safeStorage.setItem(scoped.dataUrlKey, data.avatar_url);
              }
              setAvatarUrl(resolved);
            }
          }
        } catch {
          // Ignore network or table query errors
        }
      };
      fetchProfileAvatar();
    } else if (userId && !current && !fetchedServerAvatarForUser.has(userId)) {
      const session = getPersistedDeviceSession();
      if (
        session?.access_token &&
        session.access_token !== 'demo_token' &&
        session.access_token !== 'local_token'
      ) {
        fetchedServerAvatarForUser.add(userId);
        fetch('/api/auth/user', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            ...(session.refresh_token ? { 'x-refresh-token': session.refresh_token } : {}),
          },
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((json) => {
            if (!isMounted || !json) return;
            const serverAvatar =
              json?.profile?.avatar_url ||
              json?.user?.user_metadata?.avatar_url ||
              json?.user?.user_metadata?.picture;
            if (serverAvatar && !isMockAvatarUrl(serverAvatar)) {
              const resolved = getPublicAvatarUrl(serverAvatar);
              if (resolved) {
                const scoped = getScopedKeys(userId);
                safeStorage.setItem(scoped.customUrlKey, resolved);
                safeStorage.setItem(scoped.avatarKey, serverAvatar);
                if (serverAvatar.startsWith('data:image')) {
                  safeStorage.setItem(scoped.dataUrlKey, serverAvatar);
                }
                setAvatarUrl(resolved);
              }
            }
          })
          .catch(() => {});
      }
    }

    // 3. Listen to local avatar changes and cross-device sync updates
    const handleAvatarChanged = (e: any) => {
      if (e?.detail?.userId && userId && e.detail.userId !== userId) return;
      const newUrl =
        e?.detail?.avatarUrl !== undefined ? e.detail.avatarUrl : getStoredUserAvatar(user, profile);
      if (isMounted) {
        setAvatarUrl(newUrl || null);
      }
    };

    const handleSyncUpdated = (e: any) => {
      const syncAvatar = e?.detail?.profile?.avatar_url || e?.detail?.sync?.profileSnapshot?.avatar_url;
      if (syncAvatar && !isMockAvatarUrl(syncAvatar) && isMounted) {
        const resolved = getPublicAvatarUrl(syncAvatar);
        if (resolved) {
          if (userId) {
            const scoped = getScopedKeys(userId);
            safeStorage.setItem(scoped.customUrlKey, resolved);
            safeStorage.setItem(scoped.avatarKey, syncAvatar);
            if (syncAvatar.startsWith('data:image')) {
              safeStorage.setItem(scoped.dataUrlKey, syncAvatar);
            }
          }
          setAvatarUrl(resolved);
        }
      }
    };

    const handleStorage = () => {
      const updated = getStoredUserAvatar(user, profile);
      if (isMounted) {
        setAvatarUrl(updated);
      }
    };

    window.addEventListener('user_avatar_changed', handleAvatarChanged);
    window.addEventListener(ACCOUNT_SYNC_EVENT, handleSyncUpdated);
    window.addEventListener('storage', handleStorage);

    return () => {
      isMounted = false;
      window.removeEventListener('user_avatar_changed', handleAvatarChanged);
      window.removeEventListener(ACCOUNT_SYNC_EVENT, handleSyncUpdated);
      window.removeEventListener('storage', handleStorage);
    };
  }, [
    user?.id,
    user?.user_metadata?.avatar_url,
    user?.user_metadata?.profile_photo_key,
    user?.user_metadata?.picture,
    profile?.id,
    profile?.avatar_url,
  ]);

  return avatarUrl;
}
