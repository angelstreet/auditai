'use client';

import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import MenuItem from '@mui/material/MenuItem';
import { AppIcon } from '@evolai/ui';
import type { useI18n } from '../I18nProvider';

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

const FORM_ID = 'view-as-form';

/** The form the "View as" entries submit (outside the menu, so the menu keeps its ARIA roles). */
export function ViewAsForm() {
  return <form id={FORM_ID} method="post" action="/api/view-as" hidden />;
}

/**
 * "View as" section of the account menu (TASK-P, ADR 0035), owner only: "Me: auditor" plus one
 * entry per client persona. Each entry is a submit button of {@link ViewAsForm} carrying its value,
 * so it works without JavaScript and the server decides. Returned as an array: MUI Menu does not
 * accept fragments.
 */
export function viewAsMenuItems(menu: ViewAsMenu, t: ReturnType<typeof useI18n>['t']) {
  const entry = (
    value: string,
    label: string,
    aria: string,
    current: boolean,
    icon: 'account' | 'visibility',
  ) => (
    <MenuItem
      key={value}
      component="button"
      type="submit"
      form={FORM_ID}
      name="persona"
      value={value}
      selected={current}
      aria-current={current ? 'true' : undefined}
      title={current ? `${aria} (${t('client.viewAs.current')})` : aria}
      data-testid={value === 'self' ? 'view-as-self' : 'view-as-persona'}
      sx={{ width: '100%' }}
    >
      <ListItemIcon>
        <AppIcon name={current ? 'success' : icon} />
      </ListItemIcon>
      <ListItemText primaryTypographyProps={{ sx: { whiteSpace: 'normal' } }}>{label}</ListItemText>
    </MenuItem>
  );
  return [
    <ListSubheader
      key="view-as-title"
      component="div"
      role="presentation"
      sx={{ bgcolor: 'transparent', lineHeight: 2.5, color: 'text.secondary' }}
    >
      {t('client.viewAs.section')}
    </ListSubheader>,
    entry(
      'self',
      t('client.viewAs.me'),
      t('client.viewAs.meAria'),
      menu.currentId === null,
      'account',
    ),
    ...menu.options.map((o) => entry(o.id, o.label, o.aria, menu.currentId === o.id, 'visibility')),
    <Divider key="view-as-divider" />,
  ];
}
