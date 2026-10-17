const MARK = '\u0001';

/** Split a translated sentence around its `{link}` placeholder → [before, after]. */
export const aroundLink = (translated: (vars: { link: string }) => string): [string, string] => {
  const [before = '', after = ''] = translated({ link: MARK }).split(MARK);
  return [before, after];
};
