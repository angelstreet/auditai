import Link from 'next/link';
import type { TenantId } from '@evolai/contracts';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { Logo } from '@/components/Logo';
import { tenantLabel } from '@/lib/adminData';
import { getSession } from '@/lib/authServer';
import { getT } from '@/lib/i18n';
import { AccountMenu, LanguageMenu, NavMenu, ThemeToggle, type Identity } from './HeaderControls';

const KNOWN_ROLES = new Set(['platform_owner', 'auditor', 'sponsor', 'viewer']);

/** The signed-in person, their role and current organisation, for the account menu (§11). */
const loadIdentity = async (): Promise<Identity | null> => {
  const session = await getSession();
  if (!session) return null;
  const { t } = getT();
  const first = session.tenants[0];
  const roleKey = first && KNOWN_ROLES.has(first.role) ? first.role : 'other';
  let organisation: string | null = null;
  if (first) {
    try {
      organisation = await tenantLabel(first.id as TenantId);
    } catch {
      organisation = null;
    }
  }
  return {
    name: session.name || session.email || t('common.account.roles.other'),
    email: session.email ?? null,
    role: t(`common.account.roles.${roleKey}` as 'common.account.roles.other'),
    organisation,
    organisationCount: session.tenants.length,
  };
};

/**
 * Header (docs/UI_RULES.md §5, §11): logo left; About and Privacy links; language, theme and
 * account icon controls right; the links fold into a hamburger on phones. Same surface as the
 * page, a hairline below.
 */
export default async function SiteHeader() {
  const { t } = getT();
  const identity = await loadIdentity();
  const links = [
    { href: '/about', label: t('common.nav.about') },
    { href: '/privacy', label: t('common.nav.privacy') },
  ];
  return (
    <Box
      component="header"
      className="site-header"
      sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.default' }}
    >
      <Stack
        direction="row"
        className="container topbar"
        // At 200% zoom on a phone (180 px) the controls wrap below the logo instead of scrolling.
        sx={{
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
          py: 2,
        }}
      >
        <Link href="/" aria-label={t('common.homeAria')} className="home-link">
          <Logo />
        </Link>
        <Stack
          component="nav"
          aria-label={t('common.navPrimaryAria')}
          direction="row"
          sx={{
            alignItems: 'center',
            gap: 1,
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            ml: 'auto',
            '@media (max-width: 359.98px)': { gap: 0 },
          }}
        >
          <Stack
            direction="row"
            className="nav-links"
            sx={{ display: { xs: 'none', sm: 'flex' }, gap: 5, mr: 3 }}
          >
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="nav-link">
                {l.label}
              </Link>
            ))}
          </Stack>
          <LanguageMenu />
          <ThemeToggle />
          <AccountMenu identity={identity} />
          <NavMenu links={links} />
        </Stack>
      </Stack>
    </Box>
  );
}
