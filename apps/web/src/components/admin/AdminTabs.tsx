'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { useI18n } from '@/components/I18nProvider';

const SECTIONS = [
  { href: '/board', key: 'tabPortfolio' },
  { href: '/admin/engagements', key: 'tabEngagements' },
  { href: '/admin/invitations', key: 'tabInvitations' },
  { href: '/admin/teams', key: 'tabTeams' },
  { href: '/admin/synergies', key: 'tabSynergies' },
  { href: '/admin/data', key: 'tabData' },
] as const;

/**
 * Admin section tabs (UI_RULES §5, §11): the current section is marked by colour and underline, never
 * by weight or width. The tenant query is carried across, so switching section keeps the organisation.
 */
export default function AdminTabs() {
  const { t } = useI18n();
  const pathname = usePathname() ?? '';
  const tenant = useSearchParams()?.get('tenant');
  // The printable QR sheet is a document, not a screen: no chrome on it.
  if (pathname.endsWith('/sheet')) return null;
  const current = SECTIONS.find((s) => pathname === s.href || pathname.startsWith(`${s.href}/`));
  return (
    <Tabs
      component="nav"
      aria-label={t('admin.common.tabsAria')}
      value={current?.href ?? false}
      variant="scrollable"
      scrollButtons={false}
      sx={{ mb: 6, borderBottom: 1, borderColor: 'divider', displayPrint: 'none' }}
    >
      {SECTIONS.map((s) => (
        <Tab
          key={s.href}
          value={s.href}
          label={t(`admin.common.${s.key}`)}
          href={tenant ? `${s.href}?tenant=${encodeURIComponent(tenant)}` : s.href}
          aria-current={current?.href === s.href ? 'page' : undefined}
          sx={{ minHeight: 44 }}
        />
      ))}
    </Tabs>
  );
}
