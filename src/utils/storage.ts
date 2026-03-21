const STORAGE_PREFIX = 'knowhow-lib-';

export function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(data));
  } catch {
    console.warn('Failed to save to localStorage:', key);
  }
}

export function loadFromStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    console.warn('Failed to load from localStorage:', key);
    return null;
  }
}

export function removeFromStorage(key: string): void {
  localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
}

export function clearAllStorage(): void {
  const keys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX));
  keys.forEach(k => localStorage.removeItem(k));
}

/**
 * Create a debounced storage save function
 * Reduces excessive writes to localStorage by batching updates
 */
export function createDebouncedStorage<T>(key: string, delayMs: number = 1000) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingData: T | null = null;

  return {
    save: (data: T) => {
      pendingData = data;
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (pendingData !== null) {
          saveToStorage(key, pendingData);
        }
      }, delayMs);
    },
    flush: () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (pendingData !== null) {
        saveToStorage(key, pendingData);
        pendingData = null;
      }
    },
  };
}
