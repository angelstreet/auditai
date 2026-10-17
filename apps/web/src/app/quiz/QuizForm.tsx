'use client';

import { useFormState, useFormStatus } from 'react-dom';
import type { TenantId } from '@auditai/contracts';
import type { QuizQuestion } from '@auditai/domain';
import { quizItems } from '@auditai/i18n';
import { useI18n } from '@/components/I18nProvider';
import { submitQuizAction, type QuizActionState } from './actions';

const INITIAL: QuizActionState = { ok: false, message: '' };

function SubmitButton() {
  const { t } = useI18n();
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? t('quiz.saving') : t('quiz.submit')}
    </button>
  );
}

interface Props {
  tenantId: TenantId;
  pseudonym: string;
  questions: ReadonlyArray<QuizQuestion>;
}

export function QuizForm({ tenantId, pseudonym, questions }: Props) {
  const { locale } = useI18n();
  const copy = quizItems[locale];
  const [state, formAction] = useFormState(submitQuizAction, INITIAL);
  return (
    <form action={formAction} className="quiz-form">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="respondentPseudonym" value={pseudonym} />
      {questions.map((q, idx) => (
        <fieldset key={q.code} className="quiz-q">
          <legend>
            <span className="num">{idx + 1}</span> {copy[q.code]?.prompt ?? q.prompt}
          </legend>
          {q.options.map((o) => (
            <label key={o.value} className="opt">
              <input type="radio" name={q.code} value={o.value} required />
              <span>{copy[q.code]?.options[o.value] ?? o.label}</span>
            </label>
          ))}
        </fieldset>
      ))}
      <p>
        <SubmitButton />
        {state.message ? (
          <span style={{ marginLeft: 12 }} aria-live="polite">
            {state.ok ? '✅' : '⚠️'} {state.message}
          </span>
        ) : null}
      </p>
      <style>{`
        .quiz-form { display: grid; gap: 16px; max-width: 720px; margin-top: 20px; }
        .quiz-q { background: var(--color-card); border: 1px solid var(--color-border);
          border-radius: 8px; padding: 14px 18px; }
        .quiz-q legend { font-weight: 600; }
        .quiz-q .num { display: inline-block; min-width: 22px; padding: 2px 6px;
          background: var(--color-brand-teal); color: var(--color-brand-off-white);
          border-radius: 999px; font-size: 11px; margin-right: 6px; }
        .quiz-q .opt { display: flex; gap: 10px; align-items: center;
          padding: 4px 0; font-size: 14px; }
        .btn-primary { padding: 10px 18px; background: var(--color-brand-navy);
          color: var(--color-brand-off-white); border: 0; border-radius: 8px;
          font: inherit; cursor: pointer; }
      `}</style>
    </form>
  );
}
