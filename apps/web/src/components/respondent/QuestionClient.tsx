'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { AppIcon } from '@evolai/ui';
import { finishRequest } from './finishRequest';

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
  /** The last question: after its answer or skip is saved, the survey is finished explicitly. */
  isLast: boolean;
  skipLabel: string;
  ariaQuestionLabel: string;
  messages: {
    saving: string;
    saveFailed: string;
    alreadyFinished: string;
    incomplete: string;
    finishFailed: string;
  };
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
  const [failed, setFailed] = useState<string | null>(null);
  const router = useRouter();
  const busy = saving || navigating;

  const goTo = (href: string) => startTransition(() => router.push(href));

  /** Save through `url`, then move on; the last question finishes the survey first. */
  const saveAndContinue = async (url: string, payload: object) => {
    if (busy) return;
    setFailed(null);
    setSaving(true);
    const doneHref = `/s/${props.token}/done`;
    let status = 0;
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: props.token, index: props.index, ...payload }),
      });
      status = r.status;
    } catch {
      // network error: status stays 0
    }
    if (status === 409) {
      // The survey is already finished: say so plainly, never blame the connection.
      setSaving(false);
      setFailed(props.messages.alreadyFinished);
      goTo(doneHref);
      return;
    }
    if (status < 200 || status >= 300) {
      setSaving(false);
      setFailed(props.messages.saveFailed);
      return;
    }
    if (!props.isLast) {
      setSaving(false);
      goTo(props.nextHref);
      return;
    }
    const finished = await finishRequest(props.token);
    setSaving(false);
    if (finished.kind === 'done') goTo(doneHref);
    else if (finished.kind === 'incomplete') {
      setFailed(props.messages.incomplete);
      goTo(`/s/${props.token}/q/${finished.missingIndex}`);
    } else setFailed(props.messages.finishFailed);
  };

  const choose = (choice: string) => {
    if (busy) return;
    setSelected(choice);
    void saveAndContinue('/api/answer', { choice });
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
              onClick={() => choose(option.value)}
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
          {failed}
        </p>
      ) : null}
      <div className="step-bar end">
        <button
          type="button"
          className="link-button"
          disabled={busy}
          onClick={() => void saveAndContinue('/api/skip', {})}
        >
          {props.skipLabel} →
        </button>
      </div>
    </section>
  );
}
