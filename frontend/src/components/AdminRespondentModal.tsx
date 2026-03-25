import type { AdminRespondentRawScores } from '../lib/api';

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
  const maxRawScore = Math.max(...(detail?.scales.map((scale) => scale.raw_score) ?? [12]), 12);

  return (
    <div className="modal-backdrop" role="presentation">
      <div aria-modal="true" className="modal-card modal-card--wide" role="dialog">
        <div className="modal-card__header">
          <span className="eyebrow">Испытуемый</span>
          <h2>{detail?.respondent_label ?? 'Детальный просмотр'}</h2>
          <p>
            {detail?.submitted_at
              ? `Прохождение завершено ${formatDate(detail.submitted_at)}.`
              : 'Собираем подробные сырые баллы по шкалам и вопросам.'}
          </p>
        </div>

        <div className="modal-card__body">
          {loading ? (
            <section className="card card--soft page-card page-card--centered">
              <span className="eyebrow">Сырые баллы</span>
              <h3>Загружаем детальные данные</h3>
              <p>Через мгновение здесь появятся шкалы и вклад каждого вопроса.</p>
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
              </section>

              <section className="card page-card">
                <div className="section-header">
                  <div>
                    <span className="eyebrow">Сырые баллы</span>
                    <h3>Сырые баллы по шкалам</h3>
                  </div>
                </div>

                <div className="distribution-list">
                  {detail.scales.map((scale) => (
                    <div className="distribution-row" key={scale.scale_code}>
                      <div className="distribution-row__label">
                        <strong>{scale.scale_name}</strong>
                        <span>
                          {scale.scale_code.toUpperCase()} · {scale.raw_score}
                        </span>
                      </div>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${(scale.raw_score / maxRawScore) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="card page-card">
                <div className="section-header">
                  <div>
                    <span className="eyebrow">Таблица шкал</span>
                    <h3>Шкалы и итоговые raw score</h3>
                  </div>
                </div>

                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Шкала</th>
                        <th>Код</th>
                        <th>Raw score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.scales.map((scale) => (
                        <tr key={scale.scale_code}>
                          <td>{scale.scale_name}</td>
                          <td>{scale.scale_code.toUpperCase()}</td>
                          <td>{scale.raw_score}</td>
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
                    <h3>Вклад каждого вопроса в raw score</h3>
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
                      {detail.scales.flatMap((scale) =>
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

        <div className="stack-row stack-row--end">
          <button className="button button--secondary" onClick={onClose} type="button">
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
