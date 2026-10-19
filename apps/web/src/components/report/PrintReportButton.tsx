'use client';

import Button from '@mui/material/Button';
import { AppIcon } from '@evolai/ui';

/** Secondary "Print" control of the report; the page has a print layout. */
export default function PrintReportButton({ label }: { label: string }) {
  return (
    <Button
      variant="outlined"
      onClick={() => window.print()}
      startIcon={<AppIcon name="print" size={20} />}
      sx={{ minHeight: 44 }}
    >
      {label}
    </Button>
  );
}
