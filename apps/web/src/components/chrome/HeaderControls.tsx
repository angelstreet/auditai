'use client';

import { useRouter } from 'next/navigation';
import { useState, type MouseEvent } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useColorScheme } from '@mui/material/styles';
import { LOCALE_COOKIE, supportedLocales, type SupportedLocale } from '@evolai/i18n';
import { AppIcon } from '@evolai/ui';
import { THEME_COOKIE } from '@/lib/themeChoice';
import { useI18n } from '../I18nProvider';

const YEAR = 31536000;

/** Globe icon button opening a language menu (docs/UI_RULES.md §0). Same size in every locale. */
export function LanguageMenu() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const choose = (next: SupportedLocale) => {
    setAnchor(null);
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=${YEAR}; SameSite=Lax`;
    router.refresh();
  };
  return (
    <>
      <Tooltip title={t('common.language.menuAria')}>
        <IconButton
          data-testid="language-button"
          aria-label={t('common.language.menuAria')}
          aria-haspopup="menu"
          aria-expanded={anchor ? true : undefined}
          aria-controls={anchor ? 'language-menu' : undefined}
          onClick={(e: MouseEvent<HTMLElement>) => setAnchor(e.currentTarget)}
        >
          <AppIcon name="language" />
        </IconButton>
      </Tooltip>
      <Menu
        id="language-menu"
        anchorEl={anchor}
        open={anchor !== null}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {supportedLocales.map((l) => (
          <MenuItem
            key={l}
            lang={l}
            data-testid={`switch-${l}`}
            selected={l === locale}
            aria-current={l === locale ? 'true' : undefined}
            onClick={() => choose(l)}
          >
            <ListItemIcon sx={{ visibility: l === locale ? 'visible' : 'hidden' }}>
              <AppIcon name="success" />
            </ListItemIcon>
            <ListItemText>{t(`common.language.${l}`)}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

/** Sun/moon icon button; the choice is a cookie so the server renders it without a flash. */
export function ThemeToggle() {
  const { t } = useI18n();
  const { mode, systemMode, setMode } = useColorScheme();
  // Before mount the resolved scheme is unknown on the server; keep a stable icon and label.
  const scheme = (mode === 'system' ? systemMode : mode) ?? 'light';
  const next = scheme === 'dark' ? 'light' : 'dark';
  const label = next === 'dark' ? t('common.theme.toDark') : t('common.theme.toLight');
  const toggle = () => {
    setMode(next);
    document.cookie = `${THEME_COOKIE}=${next}; Path=/; Max-Age=${YEAR}; SameSite=Lax`;
  };
  return (
    <Tooltip title={label}>
      <IconButton data-testid="theme-button" aria-label={label} onClick={toggle}>
        <AppIcon name={scheme === 'dark' ? 'themeLight' : 'themeDark'} />
      </IconButton>
    </Tooltip>
  );
}

export interface Identity {
  readonly name: string;
  readonly email: string | null;
  readonly role: string;
  readonly organisation: string | null;
  readonly organisationCount: number;
}

const initialsOf = (name: string): string =>
  name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?';

/**
 * Account control (docs/UI_RULES.md §11). Signed out: a sign-in icon button. Signed in: the
 * initials avatar plus name (name hidden on phones), opening a menu with name, email, role,
 * organisation, switch organisation and sign out. A signed-in screen is never anonymous.
 */
export function AccountMenu({ identity }: { identity: Identity | null }) {
  const { t } = useI18n();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  if (!identity) {
    return (
      <Tooltip title={t('common.account.signIn')}>
        <IconButton
          data-testid="sign-in-button"
          href="/login"
          aria-label={t('common.account.signIn')}
        >
          <AppIcon name="signIn" />
        </IconButton>
      </Tooltip>
    );
  }
  return (
    <>
      <Button
        data-testid="account-button"
        aria-haspopup="menu"
        aria-expanded={anchor ? true : undefined}
        aria-controls={anchor ? 'account-menu' : undefined}
        onClick={(e: MouseEvent<HTMLElement>) => setAnchor(e.currentTarget)}
        color="inherit"
        sx={{ px: 1.5, gap: 2, minWidth: 44, color: 'text.primary' }}
      >
        <Avatar
          aria-hidden
          sx={{ width: 32, height: 32, bgcolor: 'primary.main', color: 'primary.contrastText' }}
        >
          <Typography variant="body2" component="span" sx={{ fontWeight: 600 }}>
            {initialsOf(identity.name)}
          </Typography>
        </Avatar>
        {/* The name is the button's accessible name; on phones it is visually hidden, not removed. */}
        <Box
          component="span"
          sx={(theme) => ({
            maxWidth: 160,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            [theme.breakpoints.down('md')]: {
              position: 'absolute',
              width: 1,
              height: 1,
              clip: 'rect(0 0 0 0)',
            },
          })}
        >
          {identity.name}
        </Box>
        <AppIcon name="expand" size={16} sx={{ display: { xs: 'none', md: 'block' } }} />
      </Button>
      <Menu
        id="account-menu"
        anchorEl={anchor}
        open={anchor !== null}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 260, maxWidth: 320 } } }}
      >
        <Box sx={{ px: 4, py: 3 }} data-testid="account-identity">
          <Typography variant="cardTitle" component="p" sx={{ m: 0 }}>
            {identity.name}
          </Typography>
          {identity.email ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ m: 0, wordBreak: 'break-all' }}
            >
              {identity.email}
            </Typography>
          ) : null}
          <Typography variant="body2" color="text.secondary" sx={{ m: 0, mt: 2 }}>
            {identity.role}
            {identity.organisation ? ` · ${identity.organisation}` : ''}
          </Typography>
        </Box>
        <Divider />
        {identity.organisationCount > 1 ? (
          <MenuItem component="a" href="/admin/engagements">
            <ListItemIcon>
              <AppIcon name="organisation" />
            </ListItemIcon>
            <ListItemText>{t('common.account.switchOrganisation')}</ListItemText>
          </MenuItem>
        ) : null}
        <MenuItem component="a" href="/admin/data">
          <ListItemIcon>
            <AppIcon name="settings" />
          </ListItemIcon>
          <ListItemText>{t('common.account.workspace')}</ListItemText>
        </MenuItem>
        <Box component="form" method="post" action="/api/auth/logout" sx={{ m: 0 }}>
          <MenuItem component="button" type="submit" sx={{ width: '100%' }} data-testid="sign-out">
            <ListItemIcon>
              <AppIcon name="signOut" />
            </ListItemIcon>
            <ListItemText>{t('common.account.signOut')}</ListItemText>
          </MenuItem>
        </Box>
      </Menu>
    </>
  );
}

/** Phone-only hamburger with the text links (About, Privacy). */
export function NavMenu({ links }: { links: ReadonlyArray<{ href: string; label: string }> }) {
  const { t } = useI18n();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
      <Tooltip title={t('common.menu.open')}>
        <IconButton
          data-testid="nav-menu-button"
          aria-label={t('common.menu.open')}
          aria-haspopup="menu"
          aria-expanded={anchor ? true : undefined}
          aria-controls={anchor ? 'nav-menu' : undefined}
          onClick={(e: MouseEvent<HTMLElement>) => setAnchor(e.currentTarget)}
        >
          <AppIcon name="menu" />
        </IconButton>
      </Tooltip>
      <Menu
        id="nav-menu"
        anchorEl={anchor}
        open={anchor !== null}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {links.map((l) => (
          <MenuItem key={l.href} component="a" href={l.href}>
            {l.label}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
