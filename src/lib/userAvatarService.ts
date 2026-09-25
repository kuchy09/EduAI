import { useState, useEffect } from 'react';
import { supabase } from './supabase';

export function getPublicAvatarUrl(keyOrUrl: string | null | undefined): string | null {
  if (!keyOrUrl || typeof keyOrUrl !== 'string') return null;
  const trimmed = keyOrUrl.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }
  return `/api/download?key=${encodeURIComponent(trimmed)}&inline=true`;
}

export function getStoredUserAvatar(user?: any): string | null {
  try {
    // 1. Check direct base64 data URL in localStorage (fastest & 100% reliable)
    const directDataUrl = localStorage.getItem('user_avatar_data_url');
    if (directDataUrl && (directDataUrl.startsWith('data:image') || directDataUrl.startsWith('blob:') || directDataUrl.startsWith('http'))) {
      return directDataUrl;
    }

    // 2. Check direct cached full URL in localStorage
    const cachedUrl = localStorage.getItem('user_custom_avatar');
    if (cachedUrl && cachedUrl.trim().length > 0) {
      if (!cachedUrl.includes('photo-1534528741775-53994a69daeb')) {
        return getPublicAvatarUrl(cachedUrl);
      }
    }

    // 3. Check cached file key in localStorage
    const cachedKey = localStorage.getItem('user_profile_avatar_key');
    if (cachedKey && cachedKey.trim().length > 0) {
      return getPublicAvatarUrl(cachedKey);
    }

    // 4. Check user auth metadata
    if (user?.user_metadata?.avatar_url) {
      return getPublicAvatarUrl(user.user_metadata.avatar_url);
    }
    if (user?.user_metadata?.profile_photo_key) {
      return getPublicAvatarUrl(user.user_metadata.profile_photo_key);
    }

    // 5. Check cached chat current user object (ignoring mock female stock avatar)
    const chatCurrentUserRaw = localStorage.getItem('eduai_chat_current_user');
    if (chatCurrentUserRaw) {
      try {
        const parsed = JSON.parse(chatCurrentUserRaw);
        if (parsed?.avatar && typeof parsed.avatar === 'string' && parsed.avatar.trim().length > 0) {
          if (!parsed.avatar.includes('photo-1534528741775-53994a69daeb')) {
            return getPublicAvatarUrl(parsed.avatar);
          }
        }
      } catch {
        // Ignore json parse error
      }
    }

    // 6. Check cached chat users array
    const chatUsersRaw = localStorage.getItem('eduai_chat_users');
    if (chatUsersRaw) {
      try {
        const parsed = JSON.parse(chatUsersRaw);
        if (Array.isArray(parsed)) {
          const found = parsed.find((u: any) => u.id === user?.id || u.id === 'me');
          if (found?.avatar && !found.avatar.includes('photo-1534528741775-53994a69daeb')) {
            return getPublicAvatarUrl(found.avatar);
          }
        }
      } catch {
        // Ignore json parse error
      }
    }
  } catch (err) {
    console.warn('[userAvatarService] Error retrieving stored avatar:', err);
  }
  return null;
}

export function saveUserAvatarLocally(keyOrUrl: string, directDataUrl?: string) {
  try {
    const formattedUrl = directDataUrl || getPublicAvatarUrl(keyOrUrl);
    if (!formattedUrl) return;

    // Save direct data URL if provided (always infallible and instant 0ms preview)
    if (directDataUrl) {
      try {
        localStorage.setItem('user_avatar_data_url', directDataUrl);
      } catch (quotaErr) {
        console.warn('[userAvatarService] localStorage quota warning for directDataUrl:', quotaErr);
      }
    } else if (keyOrUrl.startsWith('data:image') || keyOrUrl.startsWith('blob:')) {
      try {
        localStorage.setItem('user_avatar_data_url', keyOrUrl);
      } catch (quotaErr) {
        console.warn('[userAvatarService] localStorage quota warning for keyOrUrl dataUrl:', quotaErr);
      }
    }

    localStorage.setItem('user_custom_avatar', formattedUrl);
    localStorage.setItem('user_profile_avatar_key', keyOrUrl);

    // Sync into eduai_chat_current_user
    try {
      const rawCurrent = localStorage.getItem('eduai_chat_current_user');
      if (rawCurrent) {
        const currentUser = JSON.parse(rawCurrent);
        currentUser.avatar = formattedUrl;
        localStorage.setItem('eduai_chat_current_user', JSON.stringify(currentUser));
      }
    } catch {
      // Ignore
    }

    // Sync into eduai_chat_users
    try {
      const raw = localStorage.getItem('eduai_chat_users');
      const users = raw ? JSON.parse(raw) : [];
      if (Array.isArray(users)) {
        let updated = false;
        users.forEach((u: any) => {
          if (u.id === 'me') {
            u.avatar = formattedUrl;
            updated = true;
          }
        });
        if (updated) {
          localStorage.setItem('eduai_chat_users', JSON.stringify(users));
        }
      }
    } catch {
      // Ignore
    }

    // Dispatch global event for instant UI update everywhere
    window.dispatchEvent(new CustomEvent('user_avatar_changed', { detail: { avatarUrl: formattedUrl, key: keyOrUrl } }));
    window.dispatchEvent(new Event('storage'));
  } catch (err) {
    console.warn('[userAvatarService] Error saving avatar locally:', err);
  }
}

export function removeUserAvatarLocally() {
  try {
    localStorage.removeItem('user_avatar_data_url');
    localStorage.removeItem('user_custom_avatar');
    localStorage.removeItem('user_profile_avatar_key');

    // Reset in chat
    try {
      const rawCurrent = localStorage.getItem('eduai_chat_current_user');
      if (rawCurrent) {
        const currentUser = JSON.parse(rawCurrent);
        delete currentUser.avatar;
        localStorage.setItem('eduai_chat_current_user', JSON.stringify(currentUser));
      }
    } catch {}

    window.dispatchEvent(new CustomEvent('user_avatar_changed', { detail: { avatarUrl: null, key: null } }));
    window.dispatchEvent(new Event('storage'));
  } catch (err) {
    console.warn('[userAvatarService] Error removing avatar locally:', err);
  }
}

export function useUserAvatar(user?: any): string | null {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => getStoredUserAvatar(user));

  useEffect(() => {
    let isMounted = true;

    // 1. Initial resolution
    const current = getStoredUserAvatar(user);
    if (current && isMounted) {
      setAvatarUrl(current);
    }

    // 2. Fetch from Supabase profiles table if available
    if (supabase) {
      const fetchProfileAvatar = async () => {
        try {
          let targetUserId = user?.id;
          if (!targetUserId) {
            const authRes = await supabase.auth.getUser();
            targetUserId = authRes?.data?.user?.id;
          }
          if (!targetUserId) return;

          const { data, error } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('id', targetUserId)
            .single();

          if (!error && data?.avatar_url && isMounted) {
            const resolved = getPublicAvatarUrl(data.avatar_url);
            if (resolved) {
              const currentDataUrl = localStorage.getItem('user_avatar_data_url');
              // Only override state if we do not already have an instant data URL preview
              if (!currentDataUrl || (!currentDataUrl.startsWith('data:image') && !currentDataUrl.startsWith('blob:'))) {
                setAvatarUrl(resolved);
              }
              localStorage.setItem('user_custom_avatar', resolved);
              localStorage.setItem('user_profile_avatar_key', data.avatar_url);
            }
          }
        } catch {
          // Ignore network or table query errors
        }
      };
      fetchProfileAvatar();
    }

    // 3. Listen to local avatar change events
    const handleAvatarChanged = (e: any) => {
      const newUrl = e?.detail?.avatarUrl !== undefined ? e.detail.avatarUrl : getStoredUserAvatar(user);
      if (isMounted) {
        setAvatarUrl(newUrl || null);
      }
    };

    const handleStorage = () => {
      const updated = getStoredUserAvatar(user);
      if (isMounted) {
        setAvatarUrl(updated);
      }
    };

    window.addEventListener('user_avatar_changed', handleAvatarChanged);
    window.addEventListener('storage', handleStorage);

    return () => {
      isMounted = false;
      window.removeEventListener('user_avatar_changed', handleAvatarChanged);
      window.removeEventListener('storage', handleStorage);
    };
  }, [user?.id, user?.user_metadata?.avatar_url, user?.user_metadata?.profile_photo_key]);

  return avatarUrl;
}
