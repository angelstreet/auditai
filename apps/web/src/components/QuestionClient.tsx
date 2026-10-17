'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

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
  /** Localised label for the continue button. */
  ctaLabel: string;
  ariaQuestionLabel: string;
  messages: { pickOption: string; saveFailed: string };
}

/**
 * Client island that renders one question and posts the choice via the /api/answer route.
 * Kept small on purpose: nothing else in the survey needs interactivity.
 */
export default function QuestionClient(props: Props) {
  const [selected, setSelected] = useState<string | null>(props.initialChoice);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleContinue = async () => {
    if (!selected) {
      setError('choose_one');
      return;
    }
    setError(null);
    const response = await fetch(`/api/answer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        token: props.token,
        index: props.index,
        choice: selected,
      }),
    });
    if (!response.ok) {
      setError('save_failed');
      return;
    }
    startTransition(() => router.push(props.nextHref));
  };

  return (
    <section aria-labelledby="question-prompt">
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
              onClick={() => setSelected(option.value)}
            >
              {option.label}
            </button>
          </li>
        ))}
      </ul>
      <p style={{ marginTop: '24px' }}>
        <button type="button" className="cta" onClick={handleContinue} disabled={pending}>
          {props.ctaLabel}
        </button>
      </p>
      {error === 'choose_one' ? (
        <p role="alert" className="muted">
          {props.messages.pickOption}
        </p>
      ) : null}
      {error === 'save_failed' ? (
        <p role="alert" className="muted">
          {props.messages.saveFailed}
        </p>
      ) : null}
    </section>
  );
}
