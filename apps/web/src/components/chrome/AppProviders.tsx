'use client';

import type { ReactNode } from 'react';
import NextLink from 'next/link';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter';
import { NotifyProvider, theme } from '@evolai/ui';
import type { ThemeChoice } from '@/lib/themeChoice';

// Every MUI control with an href (Button, MenuItem, IconButton) navigates through next/link, so
// in-app links stay client-side and the route focus lands on the new page heading. Set here, not
// in packages/ui, because the shared theme does not depend on Next.
const appTheme: typeof theme = {
  ...theme,
  components: {
    ...theme.components,
    MuiButtonBase: {
      ...theme.components?.MuiButtonBase,
      defaultProps: { ...theme.components?.MuiButtonBase?.defaultProps, LinkComponent: NextLink },
    },
  },
};

/**
 * MUI for the app router (ADR 0034): the emotion cache collects styles during server rendering
 * (no flash of unstyled content), the theme follows the cookie choice or the system scheme, and
 * MUI's own localStorage is off so the cookie is the single source of the choice.
 */
export default function AppProviders({
  choice,
  children,
}: {
  choice: ThemeChoice | null;
  children: ReactNode;
}) {
  return (
    <AppRouterCacheProvider options={{ key: 'mui' }}>
      <ThemeProvider theme={appTheme} defaultMode={choice ?? 'system'} storageManager={null}>
        <CssBaseline enableColorScheme />
        <NotifyProvider>{children}</NotifyProvider>
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
