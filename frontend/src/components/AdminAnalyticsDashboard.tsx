import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type AnalyticsSummary, type InternalConsistencyPayload, type User } from '../lib/api';
import {
  buildQuestionDistribution,
  filterQuestionsByScale,
  filterQuestionStatsByScale,
  getScaleMeta,
  getTopRawScale,
} from '../lib/adminAnalytics';
import { AdminRespondentModal } from './AdminRespondentModal';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function AdminAnalyticsDashboard({ user }: { user: User | null }) {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [matrix, setMatrix] = useState<Awaited<ReturnType<typeof api.getRespondentsRawMatrix>> | null>(null);
  const [consistency, setConsistency] = useState<InternalConsistencyPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [consistencyLoading, setConsistencyLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedScaleCode, setSelectedScaleCode] = useState<string | null>(null);
  const [selectedQuestionCode, setSelectedQuestionCode] = useState<string | null>(null);
  const [selectedConsistencyScale, setSelectedConsistencyScale] = useState<string | null>(null);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof api.getRespondentRawScores>> | null>(null);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      setSummary(null);
      setMatrix(null);
      setConsistency(null);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        const [nextSummary, nextMatrix] = await Promise.all([api.getAnalyticsSummary(), api.getRespondentsRawMatrix()]);
        if (!active) {
          return;
        }
        setSummary(nextSummary);
        setMatrix(nextMatrix);
        setSelectedScaleCode((current) => current ?? nextMatrix.scales[0]?.scale_code ?? null);
        setSelectedConsistencyScale((current) => current ?? nextMatrix.scales[0]?.scale_code ?? null);
      } catch (currentError) {
        if (active) {
          setError(currentError instanceof Error ? currentError.message : 'Не удалось загрузить аналитику');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!matrix) {
      setSelectedQuestionCode(null);
      return;
    }

    const visibleQuestions = filterQuestionsByScale(matrix.questions, selectedScaleCode);
    if (!visibleQuestions.some((question) => question.question_code === selectedQuestionCode)) {
      setSelectedQuestionCode(visibleQuestions[0]?.question_code ?? null);
    }
  }, [matrix, selectedQuestionCode, selectedScaleCode]);

  useEffect(() => {
    if (!user || user.role !== 'admin' || !selectedConsistencyScale) {
      setConsistency(null);
      return;
    }

    let active = true;
    setConsistencyLoading(true);

    const load = async () => {
      try {
        const payload = await api.getInternalConsistency(selectedConsistencyScale);
        if (active) {
          setConsistency(payload);
        }
      } catch (currentError) {
        if (active) {
          setError(currentError instanceof Error ? currentError.message : 'Не удалось загрузить внутреннюю согласованность');
        }
      } finally {
        if (active) {
          setConsistencyLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [selectedConsistencyScale, user]);

  const visibleQuestions = useMemo(
    () => filterQuestionsByScale(matrix?.questions ?? [], selectedScaleCode),
    [matrix?.questions, selectedScaleCode],
  );
  const visibleQuestionStats = useMemo(
    () => filterQuestionStatsByScale(matrix?.question_stats ?? [], selectedScaleCode),
    [matrix?.question_stats, selectedScaleCode],
  );
  const selectedScaleMeta = useMemo(
    () => getScaleMeta(matrix?.scales ?? [], selectedScaleCode),
    [matrix?.scales, selectedScaleCode],
  );
  const selectedQuestionDistribution = useMemo(
    () => buildQuestionDistribution(matrix?.respondents ?? [], selectedQuestionCode),
    [matrix?.respondents, selectedQuestionCode],
  );

  const flowerDistribution = summary?.main_flower_distribution ?? [];
  const averageRawScores = summary?.average_raw_scores ?? [];
  const maxDistribution = Math.max(...flowerDistribution.map((item) => item.count), 1);
  const maxQuestionDistribution = Math.max(...selectedQuestionDistribution.map((item) => item.count), 1);
  const maxItemCorrelation = Math.max(
    ...(consistency?.items.map((item) => Math.abs(item.item_total_correlation ?? 0)) ?? [1]),
    1,
  );

  const openRespondentDetail = async (sessionId: string) => {
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const payload = await api.getRespondentRawScores(sessionId);
      setDetail(payload);
    } catch (currentError) {
      setDetailError(currentError instanceof Error ? currentError.message : 'Не удалось загрузить детализацию');
    } finally {
      setDetailLoading(false);
    }
  };

  if (!user) {
    return (
      <section className="card page-card page-card--centered">
        <span className="eyebrow">Аналитика</span>
        <h1>Сначала войдите в систему</h1>
        <p>После входа администратору будут доступны respondent-level аналитика и психометрика.</p>
        <div className="stack-row">
          <Link className="button" to="/">
            Перейти к авторизации
          </Link>
        </div>
      </section>
    );
  }

  if (user.role !== 'admin') {
    return (
      <section className="card page-card page-card--centered">
        <span className="eyebrow">Аналитика</span>
        <h1>Эта страница доступна только администратору</h1>
        <p>Для обычного пользователя доступны личная история результатов и экран индивидуального профиля.</p>
        <div className="stack-row">
          <Link className="button" to="/results">
            Открыть историю
          </Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <div className="page-grid">
        <section className="card card--hero page-card">
          <span className="eyebrow">Аналитика</span>
          <h1>Подробная psychometric analytics по сырым баллам, вопросам и внутренней согласованности</h1>
          <p>
            В этом разделе собраны respondent-level raw scores, матрица ответов, question-level inspection и
            показатели внутренней согласованности по каждой шкале.
          </p>

          <div className="stack-row">
            <a
              className="button"
              href={api.getDetailedAnalyticsExportUrl('csv')}
              rel="noreferrer"
              target="_blank"
            >
              Экспорт detailed CSV
            </a>
            <a
              className="button button--secondary"
              href={api.getDetailedAnalyticsExportUrl('json')}
              rel="noreferrer"
              target="_blank"
            >
              Экспорт detailed JSON
            </a>
          </div>
        </section>

        {error ? <div className="notice notice--error">{error}</div> : null}

        <section className="card card--soft dashboard-grid">
          <div className="metric-item">
            <span>Всего прохождений</span>
            <strong>{loading ? '...' : summary?.total_attempts ?? 0}</strong>
          </div>
          <div className="metric-item">
            <span>Завершённых тестов</span>
            <strong>{loading ? '...' : summary?.completed_tests ?? 0}</strong>
          </div>
          <div className="metric-item">
            <span>Испытуемых в raw-матрице</span>
            <strong>{loading ? '...' : matrix?.respondents.length ?? 0}</strong>
          </div>
          <div className="metric-item">
            <span>Частый ведущий цветок</span>
            <strong>{loading ? '...' : flowerDistribution[0]?.flower_title ?? 'Пока нет данных'}</strong>
          </div>
        </section>

        {loading ? (
          <section className="card page-card page-card--centered">
            <span className="eyebrow">Аналитика</span>
            <h2>Загружаем respondent-level данные</h2>
            <p>Собираем сводку, raw matrix и психометрические показатели из backend.</p>
          </section>
        ) : null}

        {!loading && matrix ? (
          <section className="card page-card">
            <div className="section-header">
              <div>
                <span className="eyebrow">Испытуемые</span>
                <h2>Список всех прохождений</h2>
              </div>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Испытуемый</th>
                    <th>Тип доступа</th>
                    <th>Ведущая raw-шкала</th>
                    <th>Подробнее</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.respondents.map((respondent) => {
                    const topScale = getTopRawScale(respondent, matrix.scales);
                    return (
                      <tr key={respondent.session_id}>
                        <td>{respondent.submitted_at ? formatDate(respondent.submitted_at) : 'Не указана'}</td>
                        <td>
                          <strong>{respondent.respondent_label}</strong>
                          <div className="admin-subtext">{respondent.session_id}</div>
                        </td>
                        <td>{respondent.is_guest ? 'Гость' : 'Аккаунт'}</td>
                        <td>
                          {topScale.scale ? `${topScale.scale.scale_name} · ${topScale.rawScore}` : 'Нет данных'}
                        </td>
                        <td>
                          <button
                            className="button button--secondary"
                            onClick={() => void openRespondentDetail(respondent.session_id)}
                            type="button"
                          >
                            Подробнее
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {!loading && flowerDistribution.length > 0 ? (
          <section className="card page-card">
            <div className="section-header">
              <div>
                <span className="eyebrow">Распределение</span>
                <h2>Лидирующие цветки</h2>
              </div>
            </div>

            <div className="distribution-list">
              {flowerDistribution.map((item) => (
                <div className="distribution-row" key={item.flower_code}>
                  <div className="distribution-row__label">
                    <strong>
                      {item.flower_symbol} {item.flower_title}
                    </strong>
                    <span>{item.count} профилей</span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${(item.count / maxDistribution) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {!loading && averageRawScores.length > 0 ? (
          <section className="card page-card">
            <div className="section-header">
              <div>
                <span className="eyebrow">Шкалы</span>
                <h2>Средние сырые значения по шкалам</h2>
              </div>
            </div>

            <div className="distribution-list">
              {averageRawScores.map((item) => (
                <div className="distribution-row" key={item.scale_code}>
                  <div className="distribution-row__label">
                    <strong>{item.scale_title}</strong>
                    <span>
                      {item.short_code} · {item.average_raw_score.toFixed(2)}
                    </span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${(item.average_raw_score / 12) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {!loading && matrix ? (
          <section className="card page-card">
            <div className="section-header">
              <div>
                <span className="eyebrow">Question-level inspection</span>
                <h2>Матрица respondent × question и разброс по вопросам</h2>
              </div>
            </div>

            <div className="admin-controls">
              <label className="field">
                <span>Фильтр по шкале</span>
                <select value={selectedScaleCode ?? ''} onChange={(event) => setSelectedScaleCode(event.target.value)}>
                  {matrix.scales.map((scale) => (
                    <option key={scale.scale_code} value={scale.scale_code}>
                      {scale.scale_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Распределение по вопросу</span>
                <select
                  value={selectedQuestionCode ?? ''}
                  onChange={(event) => setSelectedQuestionCode(event.target.value)}
                >
                  {visibleQuestions.map((question) => (
                    <option key={question.question_code} value={question.question_code}>
                      {question.question_order}. {question.question_text}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="dashboard-grid">
              <div className="metric-item">
                <span>Выбранная шкала</span>
                <strong>{selectedScaleMeta?.scale_name ?? 'Не выбрана'}</strong>
              </div>
              <div className="metric-item">
                <span>Вопросов в таблице</span>
                <strong>{visibleQuestions.length}</strong>
              </div>
              <div className="metric-item">
                <span>Испытуемых</span>
                <strong>{matrix.respondents.length}</strong>
              </div>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table admin-table--compact">
                <thead>
                  <tr>
                    <th>Испытуемый</th>
                    {visibleQuestions.map((question) => (
                      <th key={question.question_code}>Q{question.question_order}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.respondents.map((respondent) => (
                    <tr key={respondent.session_id}>
                      <td>{respondent.respondent_label}</td>
                      {visibleQuestions.map((question) => (
                        <td key={`${respondent.session_id}-${question.question_code}`}>
                          {respondent.answers_by_question[question.question_code] ?? '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="admin-inspection-grid">
              <section className="card card--soft page-card">
                <div className="section-header">
                  <div>
                    <span className="eyebrow">По вопросам</span>
                    <h3>Средние сырые баллы и разброс</h3>
                  </div>
                </div>

                <div className="distribution-list">
                  {visibleQuestionStats.map((item) => (
                    <div className="distribution-row" key={item.question_id}>
                      <div className="distribution-row__label">
                        <strong>Q{item.question_order}</strong>
                        <span>
                          mean {item.mean_answer.toFixed(2)} · sd {item.standard_deviation.toFixed(2)} · n {item.count}
                        </span>
                      </div>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${(item.mean_answer / 4) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="card card--soft page-card">
                <div className="section-header">
                  <div>
                    <span className="eyebrow">Распределение</span>
                    <h3>Ответы по выбранному вопросу</h3>
                  </div>
                </div>

                <div className="distribution-list">
                  {selectedQuestionDistribution.map((item) => (
                    <div className="distribution-row" key={item.value}>
                      <div className="distribution-row__label">
                        <strong>{item.value}</strong>
                        <span>{item.count} ответов</span>
                      </div>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${(item.count / maxQuestionDistribution) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </section>
        ) : null}

        {!loading ? (
          <section className="card page-card">
            <div className="section-header">
              <div>
                <span className="eyebrow">Внутренняя согласованность</span>
                <h2>Cronbach’s alpha и item-total correlation</h2>
              </div>
            </div>

            <div className="admin-controls">
              <label className="field">
                <span>Шкала</span>
                <select
                  value={selectedConsistencyScale ?? ''}
                  onChange={(event) => setSelectedConsistencyScale(event.target.value)}
                >
                  {(matrix?.scales ?? []).map((scale) => (
                    <option key={scale.scale_code} value={scale.scale_code}>
                      {scale.scale_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="card card--soft dashboard-grid">
              <div className="metric-item">
                <span>Cronbach’s alpha</span>
                <strong>{consistencyLoading ? '...' : consistency?.cronbach_alpha?.toFixed(4) ?? '—'}</strong>
              </div>
              <div className="metric-item">
                <span>Испытуемых</span>
                <strong>{consistencyLoading ? '...' : consistency?.respondents_count ?? 0}</strong>
              </div>
              <div className="metric-item">
                <span>Вопросов в шкале</span>
                <strong>{consistencyLoading ? '...' : consistency?.questions_count ?? 0}</strong>
              </div>
            </div>

            {consistency?.message ? <div className="notice notice--info">{consistency.message}</div> : null}

            {consistency ? (
              <>
                <section className="card card--soft page-card">
                  <div className="section-header">
                    <div>
                      <span className="eyebrow">Item-total</span>
                      <h3>Bar chart по item-total correlation</h3>
                    </div>
                  </div>

                  <div className="distribution-list">
                    {consistency.items.map((item) => (
                      <div className="distribution-row" key={item.question_id}>
                        <div className="distribution-row__label">
                          <strong>Q{item.question_order}</strong>
                          <span>{item.item_total_correlation?.toFixed(4) ?? '—'}</span>
                        </div>
                        <div className="bar-track">
                          <div
                            className="bar-fill"
                            style={{
                              width: `${((Math.abs(item.item_total_correlation ?? 0)) / maxItemCorrelation) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <div className="admin-table-wrap">
                  <table className="admin-table admin-table--dense">
                    <thead>
                      <tr>
                        <th>Вопрос</th>
                        <th>Среднее</th>
                        <th>Дисперсия</th>
                        <th>Item-total correlation</th>
                        <th>Alpha if deleted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consistency.items.map((item) => (
                        <tr key={item.question_id}>
                          <td>
                            <strong>Q{item.question_order}</strong>
                            <div className="admin-subtext">{item.question_text}</div>
                          </td>
                          <td>{item.mean.toFixed(4)}</td>
                          <td>{item.variance.toFixed(4)}</td>
                          <td>{item.item_total_correlation?.toFixed(4) ?? '—'}</td>
                          <td>{item.alpha_if_deleted?.toFixed(4) ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </section>
        ) : null}

        {!loading && !matrix?.respondents.length ? (
          <section className="card page-card page-card--centered">
            <span className="eyebrow">Аналитика</span>
            <h2>Сводка появится после первых завершённых опросов</h2>
            <p>Когда в базе накопятся прохождения, здесь появятся respondent-level данные и psychometric metrics.</p>
          </section>
        ) : null}
      </div>

      {detail || detailLoading || detailError ? (
        <AdminRespondentModal
          detail={detail}
          error={detailError}
          formatDate={formatDate}
          loading={detailLoading}
          onClose={() => {
            setDetail(null);
            setDetailError(null);
            setDetailLoading(false);
          }}
        />
      ) : null}
    </>
  );
}
