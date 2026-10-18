'use client';

import Button from '@mui/material/Button';

export default function PrintButton({ label }: { label: string }) {
  return (
    <Button variant="contained" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
