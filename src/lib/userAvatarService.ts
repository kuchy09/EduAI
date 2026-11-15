import { useState, useEffect } from 'react';
import { getSupabaseClient, getPersistedDeviceSession, supabase } from './supabase';
import { safeStorage } from './safeStorage';
import { ACCOUNT_SYNC_EVENT, pushAccountSyncPatch } from './accountSyncService';

function isMockAvatarUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.includes('photo-1534528741775-53994a69daeb');
}

export function getPublicAvatarUrl(keyOrUrl: string | null | undefined): string | null {
  if (!keyOrUrl || typeof keyOrUrl !== 'string') return null;
  const trimmed = keyOrUrl.trim();
  if (!trimmed || isMockAvatarUrl(trimmed)) return null;
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }
  return `/api/download?key=${encodeURIComponent(trimmed)}&inline=true`;
}

function getScopedKeys(userId?: string) {
  return {
    dataUrlKey: userId ? `user_avatar_data_url_${userId}` : 'user_avatar_data_url',
    customUrlKey: userId ? `user_custom_avatar_${userId}` : 'user_custom_avatar',
    avatarKey: userId ? `user_profile_avatar_key_${userId}` : 'user_profile_avatar_key',
  };
}

export function getStoredUserAvatar(user?: any, profile?: any): string | null {
  try {
    const userId = user?.id || profile?.id;

    // 1. Prefer live cloud/profile avatar URL when available (keeps PC & phone synced)
    const profileAvatar = getPublicAvatarUrl(profile?.avatar_url);
    if (profileAvatar) {
      return profileAvatar;
    }

    // 2. Check user-scoped storage keys first
    if (userId) {
      const scoped = getScopedKeys(userId);
      const scopedUrl = safeStorage.getItem(scoped.customUrlKey);
      if (scopedUrl && !isMockAvatarUrl(scopedUrl)) {
        return getPublicAvatarUrl(scopedUrl);
      }
      const scopedKey = safeStorage.getItem(scoped.avatarKey);
      if (scopedKey && !isMockAvatarUrl(scopedKey)) {
        return getPublicAvatarUrl(scopedKey);
      }
      const scopedData = safeStorage.getItem(scoped.dataUrlKey);
      if (
        scopedData &&
        (scopedData.startsWith('data:image') || scopedData.startsWith('blob:') || scopedData.startsWith('http'))
      ) {
        return scopedData;
      }
    }

    // 3. Check user auth metadata
    const metaAvatar = getPublicAvatarUrl(user?.user_metadata?.avatar_url);
    if (metaAvatar) return metaAvatar;

    const metaPhotoKey = getPublicAvatarUrl(user?.user_metadata?.profile_photo_key);
    if (metaPhotoKey) return metaPhotoKey;

    const metaPicture = getPublicAvatarUrl(user?.user_metadata?.picture);
    if (metaPicture) return metaPicture;

    // 4. Fallback to legacy unscoped keys only if matching current/no user
    if (!userId) {
      const directDataUrl = safeStorage.getItem('user_avatar_data_url');
      if (directDataUrl && (directDataUrl.startsWith('data:image') || directDataUrl.startsWith('http'))) {
        return directDataUrl;
      }
      const cachedUrl = safeStorage.getItem('user_custom_avatar');
      if (cachedUrl && !isMockAvatarUrl(cachedUrl)) {
        return getPublicAvatarUrl(cachedUrl);
      }
      const cachedKey = safeStorage.getItem('user_profile_avatar_key');
      if (cachedKey && !isMockAvatarUrl(cachedKey)) {
        return getPublicAvatarUrl(cachedKey);
      }
    }
  } catch (err) {
    console.warn('[userAvatarService] Error retrieving stored avatar:', err);
  }
  return null;
}

export function saveUserAvatarLocally(keyOrUrl: string, directDataUrl?: string, userId?: string) {
  try {
    const formattedUrl = directDataUrl || getPublicAvatarUrl(keyOrUrl);
    if (!formattedUrl) return;

    const scoped = getScopedKeys(userId);
    const activeUserId = userId || getPersistedDeviceSession()?.user?.id;
    const activeScoped = activeUserId ? getScopedKeys(activeUserId) : scoped;

    if (directDataUrl) {
      try {
        safeStorage.setItem(activeScoped.dataUrlKey, directDataUrl);
      } catch (_) {}
    } else if (keyOrUrl.startsWith('data:image') || keyOrUrl.startsWith('blob:')) {
      try {
        safeStorage.setItem(activeScoped.dataUrlKey, keyOrUrl);
      } catch (_) {}
    }

    const remoteUrl = getPublicAvatarUrl(keyOrUrl);
    safeStorage.setItem(activeScoped.customUrlKey, remoteUrl || formattedUrl);
    safeStorage.setItem(activeScoped.avatarKey, keyOrUrl);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('user_avatar_changed', {
          detail: { avatarUrl: remoteUrl || formattedUrl, key: keyOrUrl, userId: activeUserId },
        })
      );
      window.dispatchEvent(new Event('storage'));
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
      window.dispatchEvent(
        new CustomEvent('user_avatar_changed', {
          detail: { avatarUrl: null, key: null, userId: activeUserId },
        })
      );
      window.dispatchEvent(new Event('storage'));
    }
  } catch (err) {
    console.warn('[userAvatarService] Error removing avatar locally:', err);
  }
}

async function compressImageToDataUrl(file: File, maxDim = 256): Promise<string | null> {
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
          resolve(canvas.toDataURL('image/jpeg', 0.8));
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
 * Upload profile picture to Supabase Storage ('avatars' bucket) + server disk/B2,
 * and persist the permanent URL into Supabase profiles, auth metadata, and cross-device sync.
 */
export async function uploadAndSyncUserAvatar(
  file: File,
  user: any,
  explicitToken?: string
): Promise<string | null> {
  const userId = user?.id;
  let previewDataUrl = '';

  try {
    previewDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
    if (previewDataUrl) {
      saveUserAvatarLocally(previewDataUrl, previewDataUrl, userId);
    }
  } catch (_) {}

  let permanentUrl: string | null = null;
  const sbClient = getSupabaseClient() || supabase;

  // 1. Try Supabase Storage public 'avatars' bucket first (globally accessible across PC & mobile)
  if (sbClient && userId) {
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

  // 2. Also upload to backend server disk & B2 for fallback & fast local caching
  let serverKey: string | null = null;
  try {
    const prefix = userId ? `avatars/${userId}` : 'avatars';
    const uploadRes = await fetch(
      `/api/upload-direct?filename=${encodeURIComponent(file.name)}&prefix=${encodeURIComponent(prefix)}`,
      {
        method: 'POST',
        body: file,
        headers: { 'Content-Type': file.type || 'image/png' },
      }
    );
    if (uploadRes.ok) {
      const data = await uploadRes.json().catch(() => ({}));
      if (data?.key) {
        serverKey = data.key;
      }
    }
  } catch (_) {}

  // 3. When Supabase 'avatars' bucket isn't available, prefer a portable compressed JPEG data URL
  // so avatars render identically across AI Studio containers, Vercel, Chrome, and mobile devices.
  if (!permanentUrl) {
    const compactDataUrl = await compressImageToDataUrl(file, 256);
    if (compactDataUrl) {
      permanentUrl = compactDataUrl;
    } else if (serverKey) {
      permanentUrl = `/api/download?key=${encodeURIComponent(serverKey)}&inline=true`;
    } else {
      permanentUrl = previewDataUrl || null;
    }
  }

  if (permanentUrl && userId) {
    saveUserAvatarLocally(permanentUrl, previewDataUrl || undefined, userId);

    if (sbClient) {
      try {
        await sbClient.auth.updateUser({
          data: { avatar_url: permanentUrl, profile_photo_key: permanentUrl },
        });
      } catch (_) {}

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
  }

  return permanentUrl;
}

export function useUserAvatar(user?: any, profile?: any): string | null {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => getStoredUserAvatar(user, profile));

  useEffect(() => {
    let isMounted = true;
    const userId = user?.id || profile?.id;

    // 1. Immediate resolution from profile / scoped storage / metadata
    const current = getStoredUserAvatar(user, profile);
    if (isMounted) {
      setAvatarUrl(current);
    }

    // Persist profile.avatar_url to user-scoped storage when present
    if (profile?.avatar_url && !isMockAvatarUrl(profile.avatar_url) && userId) {
      const resolved = getPublicAvatarUrl(profile.avatar_url);
      if (resolved) {
        const scoped = getScopedKeys(userId);
        safeStorage.setItem(scoped.customUrlKey, resolved);
        safeStorage.setItem(scoped.avatarKey, profile.avatar_url);
        if (isMounted) setAvatarUrl(resolved);
      }
    }

    // 2. Fetch latest avatar from Supabase profiles table
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
              setAvatarUrl(resolved);
            }
          }
        } catch {
          // Ignore network or table query errors
        }
      };
      fetchProfileAvatar();
    }

    // 3. Listen to local avatar changes and cross-device sync updates
    const handleAvatarChanged = (e: any) => {
      if (e?.detail?.userId && userId && e.detail.userId !== userId) return;
      const newUrl = e?.detail?.avatarUrl !== undefined ? e.detail.avatarUrl : getStoredUserAvatar(user, profile);
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
    profile?.id,
    profile?.avatar_url,
  ]);

  return avatarUrl;
}
