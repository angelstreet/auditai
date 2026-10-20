/**
 * Copy and share helpers for browsers (TASK-Z1). The clipboard API needs a secure context and a
 * user gesture and some phones refuse it, so there is a fallback: select a hidden textarea and
 * `execCommand('copy')`. Both return false when nothing worked; the caller then shows the full
 * text in a selectable field instead of telling people to select truncated text.
 */

export const copyViaTextarea = (text: string): boolean => {
  if (typeof document === 'undefined') return false;
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.setAttribute('aria-hidden', 'true');
  area.style.position = 'fixed';
  area.style.top = '0';
  area.style.left = '-9999px';
  area.style.opacity = '0';
  const active = document.activeElement as HTMLElement | null;
  document.body.appendChild(area);
  try {
    area.focus();
    area.select();
    area.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(area);
    active?.focus?.();
  }
};

/** Copy to the clipboard, with the textarea fallback; false when both fail. */
export const copyText = async (text: string): Promise<boolean> => {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the textarea
  }
  return copyViaTextarea(text);
};

/** The native share sheet exists (most phones, some desktops). */
export const canShare = (): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.share === 'function';

/** Open the native share sheet; false when the person cancelled or it is not available. */
export const shareText = async (data: {
  text: string;
  title?: string;
  url?: string;
}): Promise<boolean> => {
  if (!canShare()) return false;
  try {
    await navigator.share(data);
    return true;
  } catch {
    return false;
  }
};
