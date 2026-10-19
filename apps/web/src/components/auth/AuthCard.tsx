import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { Logo } from '@/components/Logo';

/** Standard narrow card of the sign-in family (login, set password, forgot password): ADR 0034. */
export default function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Box sx={{ display: 'grid', placeItems: 'center', py: { xs: 4, sm: 12 } }}>
      <Paper
        variant="outlined"
        sx={{ width: '100%', maxWidth: 400, p: { xs: 6, sm: 8 }, borderRadius: 4 }}
      >
        <Box sx={{ mb: 6 }}>
          <Logo iconOnly />
          <Typography variant="pageTitle" component="h1" sx={{ mt: 4, mb: 1 }}>
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="body2" color="text.secondary" sx={{ m: 0 }}>
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        {children}
      </Paper>
    </Box>
  );
}
