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
  const question = survey.questions[currentIndex];
  const selectedValue = answers[question.code];
  const answeredCount = responseSession?.answered_count ?? Object.keys(answers).length;
  const remaining = survey.questions.length - Object.keys(answers).length;
  const isLast = currentIndex === survey.questions.length - 1;
  const progress = ((currentIndex + 1) / survey.questions.length) * 100;

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
              {currentIndex + 1} из {survey.questions.length}
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
            <span className="eyebrow">Вопрос {currentIndex + 1}</span>
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
