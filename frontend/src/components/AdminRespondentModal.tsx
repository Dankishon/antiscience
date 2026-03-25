import { useEffect } from 'react';
import type { AdminRespondentRawScores } from '../lib/api';
import { formatDuration } from '../lib/adminAnalytics';
import { AnalyticsBarChart } from './AnalyticsCharts';

interface AdminRespondentModalProps {
  detail: AdminRespondentRawScores | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  formatDate: (value: string) => string;
}

export function AdminRespondentModal({
  detail,
  loading,
  error,
  onClose,
  formatDate,
}: AdminRespondentModalProps) {
  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeydown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [onClose]);

  const sortedScales = [...(detail?.scales ?? [])].sort((left, right) => left.rank - right.rank);
  const rawChartData = sortedScales.map((scale) => ({
    label: scale.scale_name,
    rawScore: scale.raw_score,
    flowerTitle: scale.flower_title,
  }));
  const zChartData = sortedScales.map((scale) => ({
    label: scale.scale_name,
    zScore: scale.z_score,
    flowerTitle: scale.flower_title,
  }));

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        aria-modal="true"
        className="modal-card modal-card--wide"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="modal-card__header">
          <div className="modal-card__topbar">
            <span className="eyebrow">Испытуемый</span>
            <button
              aria-label="Закрыть окно"
              className="modal-card__dismiss"
              onClick={onClose}
              type="button"
            >
              ×
            </button>
          </div>
          <div className="modal-card__headline">
            <h2>{detail?.respondent_label ?? 'Детальный просмотр'}</h2>
            <p>
              {detail?.submitted_at
                ? `Прохождение завершено ${formatDate(detail.submitted_at)}.`
                : 'Собираем детальный профиль по шкалам, вопросам и итоговым коэффициентам.'}
            </p>
          </div>
        </div>

        <div className="modal-card__body">
          {loading ? (
            <section className="card card--soft page-card page-card--centered">
              <span className="eyebrow">Профиль</span>
              <h3>Загружаем детальные данные</h3>
              <p>Через мгновение здесь появятся все шкалы, Z-оценки и вклад каждого вопроса.</p>
            </section>
          ) : null}

          {error ? <div className="notice notice--error">{error}</div> : null}

          {detail ? (
            <>
              <section className="card card--soft dashboard-grid">
                <div className="metric-item">
                  <span>Пользователь</span>
                  <strong>{detail.username}</strong>
                </div>
                <div className="metric-item">
                  <span>Формат доступа</span>
                  <strong>{detail.is_guest ? 'Гость' : 'Аккаунт'}</strong>
                </div>
                <div className="metric-item">
                  <span>Сессия</span>
                  <strong>{detail.session_id}</strong>
                </div>
                <div className="metric-item">
                  <span>Дата прохождения</span>
                  <strong>{detail.submitted_at ? formatDate(detail.submitted_at) : 'Не указана'}</strong>
                </div>
                <div className="metric-item">
                  <span>Длительность</span>
                  <strong>{formatDuration(detail.duration_seconds)}</strong>
                </div>
                <div className="metric-item">
                  <span>Главный цветок</span>
                  <strong>{detail.main_flower?.flower_title ?? 'Не указан'}</strong>
                </div>
              </section>

              <div className="admin-inspection-grid">
                <section className="card page-card">
                  <div className="section-header">
                    <div>
                      <span className="eyebrow">Сырые баллы</span>
                      <h3>Сырые баллы по шкалам</h3>
                    </div>
                  </div>

                  <AnalyticsBarChart
                    categoryKey="label"
                    data={rawChartData}
                    tooltipContent={(datum) => (
                      <>
                        <strong>{String(datum.label ?? '')}</strong>
                        <p>{String(datum.flowerTitle ?? '')}</p>
                        <p>Raw score: {String(datum.rawScore ?? '')}</p>
                      </>
                    )}
                    valueKey="rawScore"
                  />
                </section>

                <section className="card page-card">
                  <div className="section-header">
                    <div>
                      <span className="eyebrow">Z-оценки</span>
                      <h3>Z-оценки по шкалам</h3>
                    </div>
                  </div>

                  <AnalyticsBarChart
                    categoryKey="label"
                    color="#566158"
                    data={zChartData}
                    tooltipContent={(datum) => (
                      <>
                        <strong>{String(datum.label ?? '')}</strong>
                        <p>{String(datum.flowerTitle ?? '')}</p>
                        <p>Z-оценка: {Number(datum.zScore ?? 0).toFixed(2)}</p>
                      </>
                    )}
                    valueDomain={['auto', 'auto']}
                    valueKey="zScore"
                  />
                </section>
              </div>

              <section className="card page-card">
                <div className="section-header">
                  <div>
                    <span className="eyebrow">Шкалы</span>
                    <h3>Профиль по шкалам и рангам</h3>
                  </div>
                </div>

                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Ранг</th>
                        <th>Шкала</th>
                        <th>Цветок</th>
                        <th>Raw score</th>
                        <th>Z-оценка</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedScales.map((scale) => (
                        <tr key={scale.scale_code}>
                          <td>{scale.rank}</td>
                          <td>{scale.scale_name}</td>
                          <td>
                            {scale.flower_symbol} {scale.flower_title}
                          </td>
                          <td>{scale.raw_score}</td>
                          <td>{scale.z_score.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="card page-card">
                <div className="section-header">
                  <div>
                    <span className="eyebrow">Вопросы</span>
                    <h3>Вклад каждого вопроса в шкалу</h3>
                  </div>
                </div>

                <div className="admin-table-wrap">
                  <table className="admin-table admin-table--dense">
                    <thead>
                      <tr>
                        <th>№</th>
                        <th>Вопрос</th>
                        <th>Шкала</th>
                        <th>Ответ</th>
                        <th>Вклад</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedScales.flatMap((scale) =>
                        scale.questions.map((question) => (
                          <tr key={question.question_id}>
                            <td>{question.question_order}</td>
                            <td>{question.question_text}</td>
                            <td>{question.scale_name}</td>
                            <td>{question.answer_value ?? '—'}</td>
                            <td>{question.contribution_to_scale ?? '—'}</td>
                          </tr>
                        )),
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : null}
        </div>

        <div className="modal-card__footer stack-row stack-row--end">
          <button className="button button--secondary" onClick={onClose} type="button">
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
