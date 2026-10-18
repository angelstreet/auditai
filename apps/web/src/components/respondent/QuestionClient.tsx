'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { AppIcon } from '@evolai/ui';

interface Option {
  readonly value: string;
  readonly label: string;
}

interface Props {
  token: string;
  index: number;
  prompt: string;
  helper: string | null;
  options: ReadonlyArray<Option>;
  /** Pre-selected value if the user resumed. */
  initialChoice: string | null;
  nextHref: string;
  ariaQuestionLabel: string;
  messages: { saving: string; saveFailed: string };
}

/**
 * Client island that renders one question. Tapping an option saves it via /api/answer and moves
 * on: one tap per question (PRD §5). A failed save keeps the person on the question with a plain
 * message; the option they tapped stays selected so tapping again retries.
 */
export default function QuestionClient(props: Props) {
  const [selected, setSelected] = useState<string | null>(props.initialChoice);
  const [saving, setSaving] = useState(false);
  const [navigating, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const router = useRouter();
  const busy = saving || navigating;

  const choose = async (choice: string) => {
    if (busy) return;
    setSelected(choice);
    setFailed(false);
    setSaving(true);
    const ok = await fetch(`/api/answer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: props.token, index: props.index, choice }),
    })
      .then((r) => r.ok)
      .catch(() => false);
    setSaving(false);
    if (!ok) {
      setFailed(true);
      return;
    }
    startTransition(() => router.push(props.nextHref));
  };

  return (
    <section aria-labelledby="question-prompt" aria-busy={busy}>
      <h1 id="question-prompt" className="prompt">
        {props.prompt}
      </h1>
      {props.helper ? <p className="muted">{props.helper}</p> : null}
      <ul className="option-list" aria-label={props.ariaQuestionLabel}>
        {props.options.map((option) => (
          <li key={option.value}>
            <button
              type="button"
              className="option-button"
              aria-pressed={selected === option.value}
              disabled={busy}
              onClick={() => void choose(option.value)}
            >
              <span>{option.label}</span>
              <AppIcon name="success" className="option-check" />
            </button>
          </li>
        ))}
      </ul>
      <p className="muted" aria-live="polite">
        {busy ? props.messages.saving : ''}
      </p>
      {failed ? (
        <p role="alert" className="alert">
          {props.messages.saveFailed}
        </p>
      ) : null}
    </section>
  );
}
