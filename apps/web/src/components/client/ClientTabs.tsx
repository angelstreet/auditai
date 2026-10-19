'use client';

import { usePathname } from 'next/navigation';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { AppIcon } from '@evolai/ui';
import { useI18n } from '@/components/I18nProvider';

const SECTIONS = [
  { href: '/client', key: 'home', icon: 'home' },
  { href: '/client/invitations', key: 'invitations', icon: 'invite' },
  { href: '/client/results', key: 'results', icon: 'results' },
] as const;

/**
 * Team space navigation (TASK-P): three sections only, no admin or auditor link and no
 * organisation switcher. The current section is marked by colour and underline (UI_RULES §6).
 * Full width tabs; on phones the icons are dropped and labels may wrap, never clip.
 */
export default function ClientTabs() {
  const { t } = useI18n();
  const pathname = usePathname() ?? '';
  if (pathname.endsWith('/sheet')) return null;
  const current =
    [...SECTIONS].reverse().find((s) => pathname === s.href || pathname.startsWith(`${s.href}/`))
      ?.href ?? false;
  return (
    <Tabs
      component="nav"
      aria-label={t('client.nav.aria')}
      value={current}
      variant="fullWidth"
      sx={{ mb: 6, borderBottom: 1, borderColor: 'divider', displayPrint: 'none' }}
    >
      {SECTIONS.map((s) => (
        <Tab
          key={s.href}
          value={s.href}
          href={s.href}
          icon={<AppIcon name={s.icon} size={20} />}
          iconPosition="start"
          label={t(`client.nav.${s.key}`)}
          aria-current={current === s.href ? 'page' : undefined}
          data-testid={`client-tab-${s.key}`}
          sx={{
            minHeight: 44,
            minWidth: 0,
            px: { xs: 1, sm: 3 },
            whiteSpace: 'normal',
            // Phones: words only, so no label is ever clipped (TASK-S, feedback item 14).
            '& .MuiTab-icon': { display: { xs: 'none', sm: 'inline-flex' } },
          }}
        />
      ))}
    </Tabs>
  );
}
