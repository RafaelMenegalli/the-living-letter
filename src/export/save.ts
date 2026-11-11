/** Encodes a canvas as PNG. Rejects if the browser cannot encode it. */
export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      if (typeof canvas.toBlob === 'function') {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding produced nothing'))), 'image/png');
        return;
      }
      // Very old browsers: go through a data URL.
      const [, base64 = ''] = canvas.toDataURL('image/png').split(',');
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      resolve(new Blob([bytes], { type: 'image/png' }));
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

/** Hands a file to the browser's download flow. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser time to start reading the blob before releasing it.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function asFile(blob: Blob, filename: string): File | null {
  try {
    return new File([blob], filename, { type: blob.type });
  } catch {
    return null;
  }
}

/** True if the platform share sheet accepts this image (mostly phones and tablets). */
export function canShareImage(blob: Blob, filename: string): boolean {
  const file = asFile(blob, filename);
  try {
    return !!file && typeof navigator.share === 'function' && !!navigator.canShare?.({ files: [file] });
  } catch {
    return false;
  }
}

export type ShareOutcome = 'shared' | 'cancelled' | 'failed';

/** Opens the platform share sheet with the image. Closing the sheet is not an error. */
export async function shareImage(blob: Blob, filename: string): Promise<ShareOutcome> {
  const file = asFile(blob, filename);
  if (!file) return 'failed';
  try {
    await navigator.share({ files: [file] });
    return 'shared';
  } catch (error) {
    return error instanceof DOMException && error.name === 'AbortError' ? 'cancelled' : 'failed';
  }
}

/** Opens the platform share sheet with a link. */
export async function shareLink(url: string, title: string, text: string): Promise<ShareOutcome> {
  try {
    await navigator.share({ title, text, url });
    return 'shared';
  } catch (error) {
    return error instanceof DOMException && error.name === 'AbortError' ? 'cancelled' : 'failed';
  }
}

export function canShareLinks(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/**
 * Copies text to the clipboard. Tries the async clipboard API, then the legacy
 * selection-based command; reports false if neither works so the UI can ask
 * the person to copy by hand.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '0';
    area.style.left = '0';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, text.length);
    const copied = document.execCommand('copy');
    area.remove();
    return copied;
  } catch {
    return false;
  }
}
