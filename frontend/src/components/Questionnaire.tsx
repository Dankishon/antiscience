import type { ActiveSurvey, ResponseSession } from '../lib/api';

interface QuestionnaireProps {
  currentIndex: number;
  answers: Record<string, number>;
  responseSession: ResponseSession | null;
  saving: boolean;
  submitting: boolean;
  survey: ActiveSurvey;
  onBack: () => void;
  onSubmit: () => Promise<void>;
  onSelect: (questionCode: string, value: number) => Promise<void>;
}

export function Questionnaire({
  currentIndex,
  answers,
  responseSession,
  saving,
  submitting,
  survey,
  onBack,
  onSubmit,
  onSelect,
}: QuestionnaireProps) {
  const question = survey.questions[currentIndex];
  const selectedValue = answers[question.code];
  const remaining = survey.questions.length - Object.keys(answers).length;
  const isLast = currentIndex === survey.questions.length - 1;

  return (
    <section className="card">
      <div className="card__header">
        <span className="eyebrow">
          {survey.title} · {currentIndex + 1}/{survey.questions.length}
        </span>
        <h2>{question.prompt}</h2>
        <p>{survey.instruction}</p>
      </div>

      <div className="progress">
        <div className="progress__bar" style={{ width: `${((currentIndex + 1) / survey.questions.length) * 100}%` }} />
      </div>

      <div className="options">
        {survey.likert_scale.map((option) => (
          <button
            className={selectedValue === option.value ? 'option option--active' : 'option'}
            disabled={saving || submitting}
            key={option.value}
            onClick={() => void onSelect(question.code, option.value)}
            type="button"
          >
            <strong>{option.value}</strong>
            <span>{option.label}</span>
          </button>
        ))}
      </div>

      <div className="stack-row">
        <button className="button button--ghost" disabled={currentIndex === 0 || saving || submitting} onClick={onBack} type="button">
          Назад
        </button>
        <button
          className="button"
          disabled={selectedValue === undefined || submitting}
          onClick={() => void onSubmit()}
          type="button"
        >
          {isLast ? 'Завершить' : 'Далее'}
        </button>
      </div>

      <div className="meta-grid">
        <div className="meta-card">
          <span>Ответов сохранено</span>
          <strong>{responseSession?.answered_count ?? Object.keys(answers).length}</strong>
        </div>
        <div className="meta-card">
          <span>Осталось</span>
          <strong>{remaining}</strong>
        </div>
      </div>
    </section>
  );
}
