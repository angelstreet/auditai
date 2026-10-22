'use client';

import { usePathname } from 'next/navigation';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { useI18n } from '@/components/I18nProvider';

const TABS = [
  { href: '/admin/settings', key: 'members' },
  { href: '/admin/settings/data', key: 'data' },
  { href: '/admin/settings/audit', key: 'audit' },
] as const;

/** Workspace Settings sections (TASK-AD2): members, data and erasure, the audit trail. */
export function WorkspaceTabs({ tenantId }: { tenantId: string }) {
  const { t } = useI18n();
  const pathname = usePathname() ?? '';
  const current = TABS.find((x) => x.href !== '/admin/settings' && pathname.startsWith(x.href))?.href ?? '/admin/settings';
  return (
    <Tabs
      component="nav"
      aria-label={t('admin.workspace.tabsAria')}
      value={current}
      variant="scrollable"
      scrollButtons={false}
      sx={{ mb: 6, borderBottom: 1, borderColor: 'divider', displayPrint: 'none' }}
    >
      {TABS.map((x) => (
        <Tab
          key={x.href}
          value={x.href}
          label={t(`admin.workspace.tabs.${x.key}`)}
          href={`${x.href}?tenant=${encodeURIComponent(tenantId)}`}
          aria-current={current === x.href ? 'page' : undefined}
          sx={{ minHeight: 44 }}
        />
      ))}
    </Tabs>
  );
}
