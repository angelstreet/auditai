'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import type { TenantId } from '@evolai/contracts';
import type { QuizQuestion } from '@evolai/domain';
import { quizItems } from '@evolai/i18n';
import { AppIcon } from '@evolai/ui';
import ProgressBar from '@/components/ProgressBar';
import { useI18n } from '@/components/I18nProvider';
import type { QuizActionState } from './actions';

const INITIAL: QuizActionState = { ok: false, message: '' };

function Saving() {
  const { t } = useI18n();
  const { pending } = useFormStatus();
  return pending ? (
    <p className="muted" aria-live="polite">
      {t('quiz.saving')}
    </p>
  ) : null;
}

interface Props {
  action: (prev: QuizActionState, formData: FormData) => Promise<QuizActionState>;
  questions: ReadonlyArray<QuizQuestion>;
  /** Only the public demo quiz posts these; the respondent quiz derives them from the token. */
  tenantId?: TenantId;
  pseudonym?: string;
}

/**
 * One question per screen (PRD §5). Every question stays in the DOM (hidden) so the form posts all
 * five answers at once; tapping an option moves to the next question, and the last tap submits.
 */
export function QuizForm({ action, questions, tenantId, pseudonym }: Props) {
  const { locale, t } = useI18n();
  const copy = quizItems[locale];
  const [state, formAction] = useFormState(action, INITIAL);
  const [step, setStep] = useState(0);
  const form = useRef<HTMLFormElement>(null);
  const total = questions.length;

  // Move focus to the new question's heading so keyboard and screen reader users follow along.
  useEffect(() => {
    if (step === 0) return;
    const h1 = form.current?.querySelectorAll('fieldset')[step]?.querySelector('h1');
    h1?.setAttribute('tabindex', '-1');
    h1?.focus();
  }, [step]);

  const choose = (idx: number) => {
    if (idx === total - 1) form.current?.requestSubmit();
    else setStep(idx + 1);
  };

  return (
    <form ref={form} action={formAction} className="stack">
      {tenantId ? <input type="hidden" name="tenantId" value={tenantId} /> : null}
      {pseudonym ? <input type="hidden" name="respondentPseudonym" value={pseudonym} /> : null}
      <div className="step-bar">
        {step > 0 ? (
          <button type="button" className="link-button" onClick={() => setStep(step - 1)}>
            ← {t('quiz.back')}
          </button>
        ) : (
          <span />
        )}
        <span className="muted">{t('quiz.questionOf', { i: step + 1, n: total })}</span>
      </div>
      <ProgressBar
        current={step + 1}
        total={total}
        ariaLabel={t('quiz.progress')}
        valueText={t('quiz.questionOf', { i: step + 1, n: total })}
      />
      {questions.map((q, idx) => (
        <fieldset key={q.code} className="question" hidden={idx !== step}>
          <legend>
            <h1 className="prompt">{copy[q.code]?.prompt ?? q.prompt}</h1>
          </legend>
          <div className="option-list">
            {q.options.map((o) => (
              <label key={o.value} className="option-button">
                <input
                  type="radio"
                  name={q.code}
                  value={o.value}
                  required
                  onChange={() => choose(idx)}
                />
                <span>{copy[q.code]?.options[o.value] ?? o.label}</span>
                <AppIcon name="success" className="option-check" />
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <Saving />
      {state.message ? (
        <p role="alert" className="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
