import type { MessageKey, Translator } from '@evolai/i18n';

/** Client-safe twin of `enumLabel` in `lib/i18n.ts` (that module imports next/headers). */
export const enumLabelOf = (t: Translator, group: string, value: string): string => {
  const key = `admin.enums.${group}.${value}`;
  const label = t(key as MessageKey);
  return label === key ? value : label;
};
