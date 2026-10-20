'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Button from '@mui/material/Button';
import { finishRequest } from './finishRequest';

interface Props {
  token: string;
  label: string;
  messages: { failed: string };
}

/** "One more step": the explicit finish for someone who reached the done page without submitting. */
export default function FinishButton({ token, label, messages }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = async () => {
    setBusy(true);
    setError(null);
    const r = await finishRequest(token);
    if (r.kind === 'done') router.refresh();
    else if (r.kind === 'incomplete') router.push(`/s/${token}/q/${r.missingIndex}`);
    else {
      setBusy(false);
      setError(messages.failed);
    }
  };

  return (
    <>
      <Button variant="contained" disabled={busy} onClick={() => void finish()}>
        {label}
      </Button>
      {error ? (
        <p role="alert" className="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
