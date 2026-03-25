import type { ActiveSurvey, ResponseSession } from '../lib/api';

interface QuestionnaireProps {
  currentIndex: number;
  answers: Record<string, number>;
  responseSession: ResponseSession | null;
  saving: boolean;
  submitting: boolean;
  survey: ActiveSurvey;
  onBack: () => void;
  onClose: () => void;
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
  onClose,
  onSubmit,
  onSelect,
}: QuestionnaireProps) {
  const questionCount = survey.questions.length;
  const safeIndex =
    questionCount > 0 ? Math.min(Math.max(Math.trunc(currentIndex), 0), questionCount - 1) : 0;
  const question = survey.questions[safeIndex];

  if (!question || survey.likert_scale.length === 0) {
    return (
      <section className="card page-card page-card--centered">
        <span className="eyebrow">Опрос</span>
        <h1>Структура опроса сейчас недоступна</h1>
        <p>Мы не смогли безопасно восстановить вопрос или варианты ответа. Вернитесь на главную и начните заново.</p>
        <div className="stack-row">
          <button className="button" disabled={saving || submitting} onClick={onClose} type="button">
            Вернуться на главную
          </button>
        </div>
      </section>
    );
  }

  const selectedValue = answers[question.code];
  const answeredCount = responseSession?.answered_count ?? Object.keys(answers).length;
  const remaining = Math.max(questionCount - Object.keys(answers).length, 0);
  const isLast = safeIndex === questionCount - 1;
  const progress = questionCount > 0 ? ((safeIndex + 1) / questionCount) * 100 : 0;

  return (
    <div className="questionnaire-layout">
      <aside className="card card--soft questionnaire-sidebar">
        <span className="eyebrow">Структура опроса</span>
        <h2>{survey.title}</h2>
        <p>{survey.instruction}</p>

        <div className="metric-list">
          <div className="metric-item">
            <span>Текущий вопрос</span>
            <strong>
              {safeIndex + 1} из {questionCount}
            </strong>
          </div>
          <div className="metric-item">
            <span>Ответов сохранено</span>
            <strong>{answeredCount}</strong>
          </div>
          <div className="metric-item">
            <span>Осталось</span>
            <strong>{remaining}</strong>
          </div>
        </div>
      </aside>

      <section className="card questionnaire-card">
        <div className="questionnaire-card__header">
          <div>
            <span className="eyebrow">Вопрос {safeIndex + 1}</span>
            <h1>{question.prompt}</h1>
            <p className="questionnaire-card__hint">Прогресс сохраняется на этом устройстве, если вы захотите вернуться позже.</p>
          </div>
          <div className="questionnaire-card__actions">
            <p className="status-note">
              {saving ? 'Сохраняем ответ...' : submitting ? 'Формируем результат...' : 'Выберите один вариант ответа'}
            </p>
            <button
              aria-label="Закрыть опрос и вернуться на главную"
              className="button button--ghost questionnaire-card__close"
              disabled={saving || submitting}
              onClick={onClose}
              type="button"
            >
              ×
            </button>
          </div>
        </div>

        <div className="progress-block">
          <div className="progress-block__label">
            <span>Прогресс</span>
            <strong>{Math.round(progress)}%</strong>
          </div>
          <div className="progress">
            <div className="progress__bar" style={{ width: `${progress}%` }} />
          </div>
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
              <span className="option__value">{option.value}</span>
              <span className="option__content">
                <strong>{option.label}</strong>
                <small>Оценка {option.value} из 4</small>
              </span>
            </button>
          ))}
        </div>

        <div className="questionnaire-card__footer">
          <button
            className="button button--ghost"
            disabled={currentIndex === 0 || saving || submitting}
            onClick={onBack}
            type="button"
          >
            Назад
          </button>
          <button
            className="button"
            disabled={selectedValue === undefined || submitting}
            onClick={() => void onSubmit()}
            type="button"
          >
            {isLast ? 'Завершить опрос' : 'Следующий вопрос'}
          </button>
        </div>
      </section>
    </div>
  );
}
