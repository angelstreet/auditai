import Link from 'next/link';
import { emailLabel } from '@/lib/identityLabel';
import type { TenantId } from '@evolai/contracts';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Logo } from '@/components/Logo';
import { tenantLabel } from '@/lib/adminData';
import { getSession } from '@/lib/authServer';
import { orderTenants, preferredOrg } from '@/lib/orgContext';
import { allowedTenantIds } from '@/lib/tenantAccess';
import { getT } from '@/lib/i18n';
import { clientIdentity, viewAsMenuFor } from '@/lib/viewAsIdentity';
import { AccountMenu, LanguageMenu, NavMenu, ThemeToggle, type Identity } from './HeaderControls';

const KNOWN_ROLES = new Set(['platform_owner', 'auditor', 'sponsor', 'viewer']);

/** The signed-in person, their role and current organisation, for the account menu (§11). */
const loadIdentity = async (): Promise<Identity | null> => {
  const session = await getSession();
  if (!session) return null;
  const { t } = getT();
  const asClient = await clientIdentity(session, t);
  if (asClient) return asClient;
  // The organisation chosen with the switcher (cookie) comes first; never silently the first one.
  const ids = orderTenants(allowedTenantIds(session), preferredOrg());
  const currentId = ids[0] ?? session.tenants[0]?.id ?? null;
  const first = session.tenants.find((m) => m.id === currentId) ?? session.tenants[0];
  const roleKey = first && KNOWN_ROLES.has(first.role) ? first.role : 'other';
  const labelOf = async (id: string): Promise<string> => {
    try {
      return await tenantLabel(id as TenantId);
    } catch {
      return id;
    }
  };
  const organisations = await Promise.all(
    (ids.length > 0 ? ids : currentId ? [currentId] : []).map(async (id) => ({
      id,
      label: await labelOf(id),
    })),
  );
  const organisation = organisations.find((o) => o.id === currentId)?.label ?? null;
  return {
    name:
      emailLabel(session.email) ||
      t(`common.account.roles.${roleKey}` as 'common.account.roles.other'),
    email: session.email ?? null,
    role: t(`common.account.roles.${roleKey}` as 'common.account.roles.other'),
    organisation,
    organisationCount: new Set(session.tenants.map((m) => m.id)).size,
    organisations,
    organisationId: currentId,
    homeHref: '/board',
    viewAs: await viewAsMenuFor(session, t),
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
        {identity?.organisation ? (
          // The organisation being worked on is always visible, never only in a menu (ADR 0038).
          <Typography
            data-testid="header-organisation"
            variant="body2"
            component="p"
            title={identity.organisation}
            sx={{
              m: 0,
              px: 2,
              py: 1,
              borderLeft: 1,
              borderColor: 'divider',
              color: 'text.secondary',
              // One header row on a phone: there the organisation sits above the admin tabs instead.
              display: { xs: 'none', sm: 'block' },
              maxWidth: 280,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flexShrink: 1,
            }}
          >
            {identity.organisation}
          </Typography>
        ) : null}
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
