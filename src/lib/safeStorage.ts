// Safe cross-platform and iframe-resilient storage wrapper

const memoryStore = new Map<string, string>();

function isStorageAvailable(type: 'localStorage' | 'sessionStorage'): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const storage = window[type];
    if (!storage) return false;
    const testKey = `__edu_test_${type}__`;
    storage.setItem(testKey, '1');
    storage.removeItem(testKey);
    return true;
  } catch (_) {
    return false;
  }
}

const canUseLocal = isStorageAvailable('localStorage');
const canUseSession = isStorageAvailable('sessionStorage');

export const safeStorage = {
  getItem(key: string): string | null {
    if (canUseLocal) {
      try {
        return window.localStorage.getItem(key);
      } catch (_) {}
    }
    return memoryStore.get(`local:${key}`) ?? null;
  },

  setItem(key: string, value: string): void {
    if (canUseLocal) {
      try {
        window.localStorage.setItem(key, value);
        return;
      } catch (_) {}
    }
    memoryStore.set(`local:${key}`, String(value));
  },

  removeItem(key: string): void {
    if (canUseLocal) {
      try {
        window.localStorage.removeItem(key);
        return;
      } catch (_) {}
    }
    memoryStore.delete(`local:${key}`);
  },

  clear(): void {
    if (canUseLocal) {
      try {
        window.localStorage.clear();
      } catch (_) {}
    }
    for (const k of memoryStore.keys()) {
      if (k.startsWith('local:')) {
        memoryStore.delete(k);
      }
    }
  },

  getJSON<T>(key: string, fallback: T): T {
    try {
      const val = this.getItem(key);
      if (!val) return fallback;
      return JSON.parse(val) as T;
    } catch (_) {
      return fallback;
    }
  },

  setJSON(key: string, value: any): void {
    try {
      this.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }
};

export const safeSessionStorage = {
  getItem(key: string): string | null {
    if (canUseSession) {
      try {
        return window.sessionStorage.getItem(key);
      } catch (_) {}
    }
    return memoryStore.get(`session:${key}`) ?? null;
  },

  setItem(key: string, value: string): void {
    if (canUseSession) {
      try {
        window.sessionStorage.setItem(key, value);
        return;
      } catch (_) {}
    }
    memoryStore.set(`session:${key}`, String(value));
  },

  removeItem(key: string): void {
    if (canUseSession) {
      try {
        window.sessionStorage.removeItem(key);
        return;
      } catch (_) {}
    }
    memoryStore.delete(`session:${key}`);
  },

  clear(): void {
    if (canUseSession) {
      try {
        window.sessionStorage.clear();
      } catch (_) {}
    }
    for (const k of memoryStore.keys()) {
      if (k.startsWith('session:')) {
        memoryStore.delete(k);
      }
    }
  },

  getJSON<T>(key: string, fallback: T): T {
    try {
      const val = this.getItem(key);
      if (!val) return fallback;
      return JSON.parse(val) as T;
    } catch (_) {
      return fallback;
    }
  },

  setJSON(key: string, value: any): void {
    try {
      this.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }
};
