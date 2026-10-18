'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * Client-side navigation keeps focus on the old link. After every route change (not the first
 * load, where the browser already starts at the top) move focus to the page's h1 so keyboard and
 * screen reader users land on the new heading.
 */
export default function RouteFocus() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const h1 = document.querySelector<HTMLElement>('main h1');
    if (!h1) return;
    h1.setAttribute('tabindex', '-1');
    h1.focus({ preventScroll: false });
  }, [pathname]);
  return null;
}
