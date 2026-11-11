/**
 * localStorage that never throws. Private browsing modes, blocked cookies and
 * full quotas all make storage fail; the app treats it as a nice-to-have.
 */
export function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeStored(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // nothing to remove, or nowhere to remove it from
  }
}
