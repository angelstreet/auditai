import { afterEach, describe, expect, it, vi } from 'vitest';
import { canShare, copyText, shareText } from './clipboard';

const fakeDocument = (copyResult: boolean) => {
  const area = {
    value: '',
    style: {} as Record<string, string>,
    setAttribute: vi.fn(),
    focus: vi.fn(),
    select: vi.fn(),
    setSelectionRange: vi.fn(),
  };
  const body = { appendChild: vi.fn(), removeChild: vi.fn() };
  const doc = {
    createElement: vi.fn(() => area),
    body,
    activeElement: null,
    execCommand: vi.fn(() => copyResult),
  };
  return { area, doc };
};

afterEach(() => vi.unstubAllGlobals());

describe('copyText', () => {
  it('uses the clipboard API when it works', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await copyText('https://x.invalid/s/a')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('https://x.invalid/s/a');
  });

  it('falls back to a selected textarea when the clipboard API refuses', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error()) },
    });
    const { area, doc } = fakeDocument(true);
    vi.stubGlobal('document', doc);
    expect(await copyText('https://x.invalid/s/a')).toBe(true);
    expect(area.value).toBe('https://x.invalid/s/a');
    expect(area.select).toHaveBeenCalled();
    expect(doc.execCommand).toHaveBeenCalledWith('copy');
    expect(doc.body.removeChild).toHaveBeenCalledWith(area);
  });

  it('falls back when there is no clipboard API at all, and says false when that fails too', async () => {
    vi.stubGlobal('navigator', {});
    const { doc } = fakeDocument(false);
    vi.stubGlobal('document', doc);
    expect(await copyText('abc')).toBe(false);
  });
});

describe('share', () => {
  it('is available only with navigator.share', async () => {
    vi.stubGlobal('navigator', {});
    expect(canShare()).toBe(false);
    expect(await shareText({ text: 'x' })).toBe(false);
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share });
    expect(canShare()).toBe(true);
    expect(await shareText({ text: 'x' })).toBe(true);
    expect(share).toHaveBeenCalledWith({ text: 'x' });
  });

  it('treats a cancelled share sheet as not shared, without throwing', async () => {
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(new Error('AbortError')) });
    expect(await shareText({ text: 'x' })).toBe(false);
  });
});
