import { useState, useEffect } from 'react';
import { supabase } from './supabase';

export function getPublicAvatarUrl(keyOrUrl: string | null | undefined): string | null {
  if (!keyOrUrl || typeof keyOrUrl !== 'string') return null;
  const trimmed = keyOrUrl.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }
  return `/api/download?key=${encodeURIComponent(trimmed)}`;
}

export function getStoredUserAvatar(user?: any): string | null {
  try {
    // 1. Check direct cached full URL in localStorage
    const cachedUrl = localStorage.getItem('user_custom_avatar');
    if (cachedUrl && cachedUrl.trim().length > 0) {
      return getPublicAvatarUrl(cachedUrl);
    }

    // 2. Check cached file key in localStorage
    const cachedKey = localStorage.getItem('user_profile_avatar_key');
    if (cachedKey && cachedKey.trim().length > 0) {
      return getPublicAvatarUrl(cachedKey);
    }

    // 3. Check user auth metadata
    if (user?.user_metadata?.avatar_url) {
      return getPublicAvatarUrl(user.user_metadata.avatar_url);
    }
    if (user?.user_metadata?.profile_photo_key) {
      return getPublicAvatarUrl(user.user_metadata.profile_photo_key);
    }

    // 4. Check cached chat user
    const chatUsersRaw = localStorage.getItem('eduai_chat_users');
    if (chatUsersRaw) {
      const parsed = JSON.parse(chatUsersRaw);
      if (Array.isArray(parsed)) {
        const found = parsed.find((u: any) => u.id === user?.id || u.id === 'me');
        if (found?.avatar) {
          return getPublicAvatarUrl(found.avatar);
        }
      }
    }
  } catch (err) {
    console.warn('[userAvatarService] Error retrieving stored avatar:', err);
  }
  return null;
}

export function saveUserAvatarLocally(keyOrUrl: string) {
  try {
    const formattedUrl = getPublicAvatarUrl(keyOrUrl);
    if (!formattedUrl) return;

    localStorage.setItem('user_custom_avatar', formattedUrl);
    localStorage.setItem('user_profile_avatar_key', keyOrUrl);

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

export function useUserAvatar(user?: any): string | null {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => getStoredUserAvatar(user));

  useEffect(() => {
    // 1. Initial resolution
    const current = getStoredUserAvatar(user);
    if (current) {
      setAvatarUrl(current);
    }

    // 2. Fetch from Supabase profiles table if available
    let isMounted = true;
    if (supabase && user?.id) {
      const fetchProfileAvatar = async () => {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('id', user.id)
            .single();

          if (!error && data?.avatar_url && isMounted) {
            const resolved = getPublicAvatarUrl(data.avatar_url);
            if (resolved) {
              setAvatarUrl(resolved);
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
      const newUrl = e?.detail?.avatarUrl || getStoredUserAvatar(user);
      if (newUrl && isMounted) {
        setAvatarUrl(newUrl);
      }
    };

    const handleStorage = () => {
      const updated = getStoredUserAvatar(user);
      if (updated && isMounted) {
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
