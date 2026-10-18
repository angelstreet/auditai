'use client';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import MenuItem from '@mui/material/MenuItem';
import { AppIcon } from '@evolai/ui';
import { useI18n } from '../I18nProvider';

export interface ViewAsOption {
  /** memberships.id posted back; the server re-reads and re-checks everything else. */
  readonly id: string;
  readonly label: string;
  readonly aria: string;
}

export interface ViewAsMenu {
  readonly options: readonly ViewAsOption[];
  /** Membership id of the persona being viewed, or null on the owner's own view. */
  readonly currentId: string | null;
}

/**
 * "View as" section of the account menu (TASK-P, ADR 0035), owner only: "Me: auditor" plus one
 * entry per client persona. Each entry is a tiny form posting to /api/view-as, so it works without
 * JavaScript and the server decides. Returned as an array: MUI Menu does not accept fragments.
 */
export function viewAsMenuItems(menu: ViewAsMenu, t: ReturnType<typeof useI18n>['t']) {
  const entry = (value: string, label: string, aria: string, current: boolean, icon: 'account' | 'visibility') => (
    <Box key={value} component="form" method="post" action="/api/view-as" sx={{ m: 0 }}>
      <input type="hidden" name="persona" value={value} />
      <MenuItem
        component="button"
        type="submit"
        selected={current}
        aria-current={current ? 'true' : undefined}
        title={aria}
        data-testid={value === 'self' ? 'view-as-self' : 'view-as-persona'}
        sx={{ width: '100%' }}
      >
        <ListItemIcon>
          <AppIcon name={current ? 'success' : icon} />
        </ListItemIcon>
        <ListItemText
          primary={label}
          secondary={current ? t('client.viewAs.current') : undefined}
          primaryTypographyProps={{ sx: { whiteSpace: 'normal' } }}
        />
      </MenuItem>
    </Box>
  );
  return [
    <ListSubheader key="view-as-title" sx={{ bgcolor: 'transparent', lineHeight: 2.5 }}>
      {t('client.viewAs.section')}
    </ListSubheader>,
    entry('self', t('client.viewAs.me'), t('client.viewAs.meAria'), menu.currentId === null, 'account'),
    ...menu.options.map((o) => entry(o.id, o.label, o.aria, menu.currentId === o.id, 'visibility')),
    <Divider key="view-as-divider" />,
  ];
}
