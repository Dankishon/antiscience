import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  type AdminQuestionStatsPayload,
  type AnalyticsSummary,
  type InternalConsistencyPayload,
  type User,
} from '../lib/api';
import {
  buildFlowerDistribution,
  buildQuestionHeatmapRows,
  buildScaleBoxplots,
  buildScaleHeatmapRows,
  buildScaleHistogram,
  buildZScoreHistogram,
  filterQuestionsByScale,
  formatDuration,
  getHeatmapIntensity,
  getQuestionDistribution,
  getScaleMeta,
  getTopRawScale,
  type HeatmapMode,
  type ScaleBoxplotStat,
} from '../lib/adminAnalytics';
import { AnalyticsBarChart } from './AnalyticsCharts';
import { AdminRespondentModal } from './AdminRespondentModal';

type AdminTab = 'overview' | 'respondents' | 'questions' | 'consistency';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(value));
}

function ChartHelper({ children }: { children: string }) {
  return <p className="chart-helper">{children}</p>;
}

function formatRespondentCount(count: number): string {
  const remainder10 = count % 10;
  const remainder100 = count % 100;
  if (remainder10 === 1 && remainder100 !== 11) {
    return `${count} испытуемый`;
  }
  if (remainder10 >= 2 && remainder10 <= 4 && (remainder100 < 12 || remainder100 > 14)) {
    return `${count} испытуемых`;
  }
  return `${count} испытуемых`;
}

function HeatmapTable({
  columns,
  rows,
  mode,
}: {
  columns: Array<{ key: string; label: string }>;
  rows: Array<{
    id: string;
    label: string;
    values: Array<{ key: string; value: number | null | undefined }>;
  }>;
  mode: HeatmapMode;
}) {
  const getCellStyle = (value: number | null | undefined) => {
    const intensity = getHeatmapIntensity(value, mode);
    if (typeof value !== 'number') {
      return undefined;
    }

    const alpha = 0.1 + intensity * 0.5;
    const positive = mode === 'raw' || value >= 0;
    const background = positive ? `rgba(45, 58, 51, ${alpha})` : `rgba(142, 84, 70, ${alpha})`;

    return {
      background,
      color: intensity > 0.48 ? '#f7f7f3' : 'var(--text)',
    };
  };

  return (
    <div className="heatmap-wrap">
      <table className="heatmap-table">
        <thead>
          <tr>
            <th>Испытуемый</th>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="heatmap-table__sticky">{row.label}</td>
              {row.values.map((cell) => (
                <td key={`${row.id}-${cell.key}`}>
                  <span className="heatmap-cell" style={getCellStyle(cell.value)}>
                    {typeof cell.value === 'number' ? (mode === 'z' ? cell.value.toFixed(2) : cell.value) : '—'}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BoxplotComparison({
  stats,
  mode,
}: {
  stats: ScaleBoxplotStat[];
  mode: HeatmapMode;
}) {
  const values = stats.flatMap((item) => [item.min, item.q1, item.median, item.q3, item.max, ...item.outliers]);
  const fallbackMax = mode === 'raw' ? 12 : 3;
  const minValue = values.length > 0 ? Math.min(...values, mode === 'raw' ? 0 : -fallbackMax) : 0;
  const maxValue = values.length > 0 ? Math.max(...values, fallbackMax) : fallbackMax;
  const range = maxValue - minValue || 1;
  const toPercent = (value: number) => ((value - minValue) / range) * 100;

  return (
    <div className="boxplot-list">
      {stats.map((item) => (
        <article className="boxplot-row" key={item.scale_code}>
          <div className="boxplot-row__label">
            <strong>{item.scale_name}</strong>
            <span>
              med {item.median.toFixed(2)} · q1 {item.q1.toFixed(2)} · q3 {item.q3.toFixed(2)}
            </span>
          </div>
          <div className="boxplot-track">
            <div
              className="boxplot-track__whisker"
              style={{ left: `${toPercent(item.min)}%`, width: `${toPercent(item.max) - toPercent(item.min)}%` }}
            />
            <div
              className="boxplot-track__box"
              style={{ left: `${toPercent(item.q1)}%`, width: `${toPercent(item.q3) - toPercent(item.q1)}%` }}
            />
            <div className="boxplot-track__median" style={{ left: `${toPercent(item.median)}%` }} />
            {item.outliers.map((value, index) => (
              <span
                className="boxplot-track__outlier"
                key={`${item.scale_code}-outlier-${index}`}
                style={{ left: `${toPercent(value)}%` }}
              />
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

export function AdminAnalyticsDashboard({ user }: { user: User | null }) {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [matrix, setMatrix] = useState<Awaited<ReturnType<typeof api.getRespondentsRawMatrix>> | null>(null);
  const [questionStats, setQuestionStats] = useState<AdminQuestionStatsPayload | null>(null);
  const [consistency, setConsistency] = useState<InternalConsistencyPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [questionStatsLoading, setQuestionStatsLoading] = useState(false);
  const [consistencyLoading, setConsistencyLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedQuestionScale, setSelectedQuestionScale] = useState<string | null>(null);
  const [selectedHistogramScale, setSelectedHistogramScale] = useState<string | null>(null);
  const [selectedQuestionCode, setSelectedQuestionCode] = useState<string | null>(null);
  const [selectedConsistencyScale, setSelectedConsistencyScale] = useState<string | null>(null);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof api.getRespondentRawScores>> | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [scaleHeatmapMode, setScaleHeatmapMode] = useState<HeatmapMode>('raw');
  const detailRequestIdRef = useRef(0);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      setSummary(null);
      setMatrix(null);
      setQuestionStats(null);
      setConsistency(null);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        const [nextSummary, nextMatrix, nextQuestionStats] = await Promise.all([
          api.getAnalyticsSummary(),
          api.getRespondentsRawMatrix(),
          api.getQuestionStats(),
        ]);
        if (!active) {
          return;
        }
        setSummary(nextSummary);
        setMatrix(nextMatrix);
        setQuestionStats(nextQuestionStats);
        setSelectedHistogramScale((current) => current ?? nextMatrix.scales[0]?.scale_code ?? null);
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
    if (!user || user.role !== 'admin') {
      setQuestionStats(null);
      return;
    }

    let active = true;
    setQuestionStatsLoading(true);
    setQuestionStats(null);

    const load = async () => {
      try {
        const payload = await api.getQuestionStats(selectedQuestionScale ?? undefined);
        if (active) {
          setQuestionStats(payload);
        }
      } catch (currentError) {
        if (active) {
          setError(currentError instanceof Error ? currentError.message : 'Не удалось загрузить статистику по вопросам');
        }
      } finally {
        if (active) {
          setQuestionStatsLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [selectedQuestionScale, user]);

  useEffect(() => {
    if (!user || user.role !== 'admin' || !selectedConsistencyScale) {
      setConsistency(null);
      return;
    }

    let active = true;
    setConsistencyLoading(true);
    setConsistency(null);

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

  useEffect(() => {
    const visibleQuestions = questionStats?.questions ?? filterQuestionsByScale(matrix?.questions ?? [], selectedQuestionScale);
    if (!visibleQuestions.some((question) => question.question_code === selectedQuestionCode)) {
      setSelectedQuestionCode(visibleQuestions[0]?.question_code ?? null);
    }
  }, [matrix?.questions, questionStats?.questions, selectedQuestionCode, selectedQuestionScale]);

  const scales = matrix?.scales ?? [];
  const respondents = matrix?.respondents ?? [];
  const visibleQuestions = questionStats?.questions ?? filterQuestionsByScale(matrix?.questions ?? [], selectedQuestionScale);
  const selectedScaleMeta = useMemo(
    () => getScaleMeta(scales, selectedHistogramScale),
    [scales, selectedHistogramScale],
  );
  const selectedQuestionDistribution = useMemo(
    () => getQuestionDistribution(questionStats?.questions ?? [], selectedQuestionCode),
    [questionStats?.questions, selectedQuestionCode],
  );
  const histogramData = useMemo(
    () => buildScaleHistogram(respondents, selectedHistogramScale),
    [respondents, selectedHistogramScale],
  );
  const zHistogramData = useMemo(
    () => buildZScoreHistogram(respondents, selectedHistogramScale),
    [respondents, selectedHistogramScale],
  );
  const boxplotData = useMemo(
    () => buildScaleBoxplots(respondents, scales, scaleHeatmapMode),
    [respondents, scales, scaleHeatmapMode],
  );
  const scaleHeatmapRows = useMemo(
    () => buildScaleHeatmapRows(respondents, scales, scaleHeatmapMode),
    [respondents, scales, scaleHeatmapMode],
  );
  const questionHeatmapRows = useMemo(
    () => buildQuestionHeatmapRows(respondents, visibleQuestions),
    [respondents, visibleQuestions],
  );
  const flowerDistribution = useMemo(
    () => buildFlowerDistribution(summary?.main_flower_distribution ?? [], respondents),
    [respondents, summary?.main_flower_distribution],
  );
  const averageRawScores = summary?.average_raw_scores ?? [];
  const distributedRespondentsCount = flowerDistribution.reduce((total, item) => total + item.count, 0);
  const distributionMaxCount = Math.max(...flowerDistribution.map((item) => item.count), 1);

  const openRespondentDetail = async (sessionId: string) => {
    const requestId = detailRequestIdRef.current + 1;
    detailRequestIdRef.current = requestId;
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const payload = await api.getRespondentRawScores(sessionId);
      if (detailRequestIdRef.current !== requestId) {
        return;
      }
      setDetail(payload);
    } catch (currentError) {
      if (detailRequestIdRef.current !== requestId) {
        return;
      }
      setDetailError(currentError instanceof Error ? currentError.message : 'Не удалось загрузить детализацию');
    } finally {
      if (detailRequestIdRef.current === requestId) {
        setDetailLoading(false);
      }
    }
  };

  if (!user) {
    return (
      <section className="card page-card page-card--centered">
        <span className="eyebrow">Аналитика</span>
        <h1>Сначала войдите в систему</h1>
        <p>После входа администратору будут доступны аналитика по прохождениям и психометрические показатели.</p>
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
          <h1>Платформа визуальной аналитики по профилям, вопросам и качеству опросника</h1>
          <p>
            Здесь собраны распределения по цветкам, профили испытуемых, вопросный уровень, тепловые карты и
            показатели внутренней согласованности по каждой шкале.
          </p>

          <div className="stack-row">
            <a
              className="button"
              href={api.getDetailedAnalyticsExportUrl('csv')}
              rel="noreferrer"
              target="_blank"
            >
              Подробный CSV
            </a>
            <a
              className="button button--secondary"
              href={api.getDetailedAnalyticsExportUrl('json')}
              rel="noreferrer"
              target="_blank"
            >
              Подробный JSON
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
            <span>Испытуемых в матрице</span>
            <strong>{loading ? '...' : respondents.length}</strong>
          </div>
          <div className="metric-item">
            <span>Частый главный цветок</span>
            <strong>{loading ? '...' : flowerDistribution[0]?.flower_title ?? 'Пока нет данных'}</strong>
          </div>
        </section>

        <section className="card page-card">
          <div className="tabs">
            <button
              className={`tab${activeTab === 'overview' ? ' tab--active' : ''}`}
              onClick={() => setActiveTab('overview')}
              type="button"
            >
              Сводка
            </button>
            <button
              className={`tab${activeTab === 'respondents' ? ' tab--active' : ''}`}
              onClick={() => setActiveTab('respondents')}
              type="button"
            >
              Испытуемые
            </button>
            <button
              className={`tab${activeTab === 'questions' ? ' tab--active' : ''}`}
              onClick={() => setActiveTab('questions')}
              type="button"
            >
              Вопросы
            </button>
            <button
              className={`tab${activeTab === 'consistency' ? ' tab--active' : ''}`}
              onClick={() => setActiveTab('consistency')}
              type="button"
            >
              Надежность
            </button>
          </div>
        </section>

        {loading ? (
          <section className="card page-card page-card--centered">
            <span className="eyebrow">Аналитика</span>
            <h2>Загружаем данные</h2>
            <p>Собираем сводку, матрицы ответов и психометрические показатели с backend.</p>
          </section>
        ) : null}

        {!loading && activeTab === 'overview' ? (
          <>
            <div className="admin-section-grid">
              <section className="card page-card">
                <div className="section-header">
                  <div>
                    <span className="eyebrow">Распределение</span>
                    <h2>Распределение главных цветков</h2>
                  </div>
                </div>

                <AnalyticsBarChart
                  categoryKey="flower_title"
                  data={flowerDistribution}
                  tooltipContent={(datum) => (
                    <>
                      <strong>
                        {String(datum.flower_symbol ?? '')} {String(datum.flower_title ?? '')}
                      </strong>
                      <p>Число испытуемых: {String(datum.count ?? '')}</p>
                    </>
                  )}
                  valueKey="count"
                />
                <ChartHelper>
                  Этот график показывает, сколько раз каждый цветок становился главным по итогам завершённых
                  прохождений. Он помогает увидеть доминирующие профили в текущей базе.
                </ChartHelper>

                {flowerDistribution.length > 0 ? (
                  <>
                    <div className="metric-item">
                      <span>Испытуемых в сводке</span>
                      <strong>{distributedRespondentsCount}</strong>
                    </div>

                    <div className="distribution-list">
                      {flowerDistribution.map((item) => (
                        <article className="distribution-row" key={item.flower_code}>
                          <div className="distribution-row__label">
                            <strong>
                              {item.flower_symbol ? `${item.flower_symbol} ` : ''}
                              {item.flower_title}
                            </strong>
                            <span>{formatRespondentCount(item.count)}</span>
                          </div>
                          <div className="distribution-row__value">
                            <div className="bar-track">
                              <div
                                className="bar-fill"
                                style={{ width: `${(item.count / distributionMaxCount) * 100}%` }}
                              />
                            </div>
                            <strong className="distribution-row__count">{item.count}</strong>
                          </div>
                        </article>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="notice notice--info">
                    После первых завершённых прохождений здесь появится сводка по главным цветкам и числу испытуемых.
                  </div>
                )}
              </section>

              <section className="card page-card">
                <div className="section-header">
                  <div>
                    <span className="eyebrow">Шкалы</span>
                    <h2>Средние сырые баллы по шкалам</h2>
                  </div>
                </div>

                <AnalyticsBarChart
                  categoryKey="scale_title"
                  data={averageRawScores}
                  tooltipContent={(datum) => (
                    <>
                      <strong>{String(datum.scale_title ?? '')}</strong>
                      <p>Средний сырой балл: {Number(datum.average_raw_score ?? 0).toFixed(2)}</p>
                    </>
                  )}
                  valueDomain={[0, 12]}
                  valueKey="average_raw_score"
                  xTickFormatter={(value) => String(value).slice(0, 10)}
                />
                <ChartHelper>
                  Здесь показано среднее значение сырых баллов по каждой шкале среди всех завершённых прохождений. Это
                  удобно для сравнения общей выраженности шкал без нормализации.
                </ChartHelper>
              </section>
            </div>

            <div className="admin-section-grid">
              <section className="card page-card">
                <div className="section-header">
                  <div>
                    <span className="eyebrow">Распределения</span>
                    <h2>Распределение сырых баллов по шкале</h2>
                  </div>
                </div>

                <div className="admin-controls">
                  <label className="field">
                    <span>Шкала</span>
                    <select
                      value={selectedHistogramScale ?? ''}
                      onChange={(event) => setSelectedHistogramScale(event.target.value)}
                    >
                      {scales.map((scale) => (
                        <option key={scale.scale_code} value={scale.scale_code}>
                          {scale.scale_name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="metric-item">
                  <span>Выбранная шкала</span>
                  <strong>{selectedScaleMeta?.scale_name ?? 'Не выбрана'}</strong>
                </div>

                <AnalyticsBarChart
                  categoryKey="value"
                  data={histogramData}
                  tooltipContent={(datum) => (
                    <>
                      <strong>Сырой балл: {String(datum.value ?? '')}</strong>
                      <p>Испытуемых: {String(datum.count ?? '')}</p>
                    </>
                  )}
                  valueKey="count"
                />
                <ChartHelper>
                  Гистограмма показывает, как распределяются сырые баллы по выбранной шкале среди всех испытуемых.
                  Это помогает заметить скошенные распределения, концентрацию в центре и редкие экстремальные случаи.
                </ChartHelper>
              </section>

              <section className="card page-card">
                <div className="section-header">
                  <div>
                    <span className="eyebrow">Распределения</span>
                    <h2>Распределение стандартизированных значений (Z-оценок)</h2>
                  </div>
                </div>

                <div className="metric-item">
                  <span>Выбранная шкала</span>
                  <strong>{selectedScaleMeta?.scale_name ?? 'Не выбрана'}</strong>
                </div>

                <AnalyticsBarChart
                  categoryKey="label"
                  color="#556057"
                  data={zHistogramData}
                  tooltipContent={(datum) => (
                    <>
                      <strong>{String(datum.label ?? '')}</strong>
                      <p>
                        Диапазон: {Number(datum.from ?? 0).toFixed(1)} ... {Number(datum.to ?? 0).toFixed(1)}
                      </p>
                      <p>Испытуемых: {String(datum.count ?? '')}</p>
                    </>
                  )}
                  valueKey="count"
                  widthPerItem={92}
                />
                <ChartHelper>
                  Эта гистограмма показывает распределение Z-оценок по выбранной шкале. В текущем проекте Z-оценка
                  рассчитывается внутри одного профиля: она показывает, насколько шкала отклоняется от среднего уровня
                  по 10 шкалам конкретного испытуемого.
                </ChartHelper>
              </section>

              <section className="card page-card">
                <div className="section-header">
                  <div>
                    <span className="eyebrow">Сравнение</span>
                    <h2>Сравнение распределений по шкалам</h2>
                  </div>
                </div>

                <div className="tabs tabs--compact">
                  <button
                    className={`tab${scaleHeatmapMode === 'raw' ? ' tab--active' : ''}`}
                    onClick={() => setScaleHeatmapMode('raw')}
                    type="button"
                  >
                    Сырые баллы
                  </button>
                  <button
                    className={`tab${scaleHeatmapMode === 'z' ? ' tab--active' : ''}`}
                    onClick={() => setScaleHeatmapMode('z')}
                    type="button"
                  >
                    Z-оценки
                  </button>
                </div>

                <BoxplotComparison mode={scaleHeatmapMode} stats={boxplotData} />
                <ChartHelper>
                  Диаграмма размаха сравнивает распределения по шкалам через медиану, квартильный размах и выбросы.
                  Она нужна, чтобы быстро увидеть асимметрию, разброс и нестандартные наблюдения по каждой шкале.
                </ChartHelper>
              </section>
            </div>

            <section className="card page-card">
              <div className="section-header">
                <div>
                  <span className="eyebrow">Тепловая карта</span>
                  <h2>Тепловая карта профилей по шкалам</h2>
                </div>
              </div>

              <div className="tabs tabs--compact">
                <button
                  className={`tab${scaleHeatmapMode === 'raw' ? ' tab--active' : ''}`}
                  onClick={() => setScaleHeatmapMode('raw')}
                  type="button"
                >
                  Сырые баллы
                </button>
                <button
                  className={`tab${scaleHeatmapMode === 'z' ? ' tab--active' : ''}`}
                  onClick={() => setScaleHeatmapMode('z')}
                  type="button"
                >
                  Z-оценки
                </button>
              </div>

              <HeatmapTable
                columns={scales.map((scale) => ({ key: scale.scale_code, label: scale.short_code }))}
                mode={scaleHeatmapMode}
                rows={scaleHeatmapRows.map((row) => ({
                  id: row.session_id,
                  label: row.respondent_label,
                  values: row.values.map((value) => ({ key: value.scale_code, value: value.value })),
                }))}
              />
              <ChartHelper>
                Тепловая карта показывает профиль каждого испытуемого сразу по всем шкалам. Режим сырых баллов
                помогает увидеть абсолютную выраженность, а режим Z-оценок показывает отклонение шкалы от среднего
                уровня внутри конкретного профиля.
              </ChartHelper>
            </section>
          </>
        ) : null}

        {!loading && activeTab === 'respondents' ? (
          <section className="card page-card">
            <div className="section-header">
              <div>
                <span className="eyebrow">Испытуемые</span>
                <h2>Список всех завершённых прохождений</h2>
              </div>
            </div>
            <ChartHelper>
              Таблица показывает все завершённые прохождения с основными метаданными. Через неё удобно переходить к
              детальному разбору конкретного профиля без повторного поиска по базе.
            </ChartHelper>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Испытуемый</th>
                    <th>Тип доступа</th>
                    <th>Длительность</th>
                    <th>Главный цветок</th>
                    <th>Ведущая шкала</th>
                    <th>Подробнее</th>
                  </tr>
                </thead>
                <tbody>
                  {respondents.map((respondent) => {
                    const topScale = getTopRawScale(respondent, scales);
                    return (
                      <tr key={respondent.session_id}>
                        <td>{respondent.submitted_at ? formatDate(respondent.submitted_at) : 'Не указана'}</td>
                        <td>
                          <strong>{respondent.respondent_label}</strong>
                          <div className="admin-subtext">{respondent.session_id}</div>
                        </td>
                        <td>{respondent.is_guest ? 'Гость' : 'Аккаунт'}</td>
                        <td>{formatDuration(respondent.duration_seconds)}</td>
                        <td>{respondent.main_flower_title ?? 'Не указан'}</td>
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

        {!loading && activeTab === 'questions' ? (
          <>
            <section className="card page-card">
              <div className="section-header">
                <div>
                  <span className="eyebrow">Вопросы</span>
                  <h2>Тепловая карта ответов по вопросам</h2>
                </div>
              </div>

              <div className="admin-controls">
                <label className="field">
                  <span>Фильтр по шкале</span>
                  <select
                    value={selectedQuestionScale ?? ''}
                    onChange={(event) => setSelectedQuestionScale(event.target.value || null)}
                  >
                    <option value="">Все вопросы</option>
                    {scales.map((scale) => (
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
                  <span>Фильтр</span>
                  <strong>{selectedQuestionScale ? getScaleMeta(scales, selectedQuestionScale)?.scale_name : 'Все вопросы'}</strong>
                </div>
                <div className="metric-item">
                  <span>Вопросов в таблице</span>
                  <strong>{questionStatsLoading ? '...' : visibleQuestions.length}</strong>
                </div>
                <div className="metric-item">
                  <span>Испытуемых</span>
                  <strong>{respondents.length}</strong>
                </div>
              </div>

              <HeatmapTable
                columns={visibleQuestions.map((question) => ({
                  key: question.question_code,
                  label: `Q${question.question_order}`,
                }))}
                mode="raw"
                rows={questionHeatmapRows.map((row) => ({
                  id: row.session_id,
                  label: row.respondent_label,
                  values: row.values.map((value) => ({ key: value.question_code, value: value.value })),
                }))}
              />
              <ChartHelper>
                Тепловая карта показывает ответы всех испытуемых по каждому вопросу. Она помогает находить атипичные
                паттерны, локальные перекосы и вопросы, которые ведут себя нестабильно внутри шкалы.
              </ChartHelper>
            </section>

            <div className="admin-section-grid">
              <section className="card page-card">
                <div className="section-header">
                  <div>
                    <span className="eyebrow">Средние</span>
                    <h2>Средний балл по каждому вопросу</h2>
                  </div>
                </div>

                <AnalyticsBarChart
                  categoryKey="label"
                  data={visibleQuestions.map((question) => {
                    const stat = questionStats?.questions.find((item) => item.question_code === question.question_code);
                    return {
                      label: `Q${question.question_order}`,
                      mean: stat?.mean_answer ?? 0,
                      questionText: question.question_text,
                    };
                  })}
                  tooltipContent={(datum) => (
                    <>
                      <strong>{String(datum.label ?? '')}</strong>
                      <p>{String(datum.questionText ?? '')}</p>
                      <p>Средний балл: {Number(datum.mean ?? 0).toFixed(2)}</p>
                    </>
                  )}
                  valueDomain={[0, 4]}
                  valueKey="mean"
                  widthPerItem={52}
                />
                <ChartHelper>
                  График показывает средний ответ по каждому вопросу. Он помогает увидеть, какие утверждения чаще
                  получают высокие или низкие оценки в текущей выборке.
                </ChartHelper>
              </section>

              <section className="card page-card">
                <div className="section-header">
                  <div>
                    <span className="eyebrow">Вариативность</span>
                    <h2>Вариативность ответов по вопросам</h2>
                  </div>
                </div>

                <AnalyticsBarChart
                  categoryKey="label"
                  color="#58645a"
                  data={visibleQuestions.map((question) => {
                    const stat = questionStats?.questions.find((item) => item.question_code === question.question_code);
                    return {
                      label: `Q${question.question_order}`,
                      standardDeviation: stat?.standard_deviation ?? 0,
                      questionText: question.question_text,
                    };
                  })}
                  tooltipContent={(datum) => (
                    <>
                      <strong>{String(datum.label ?? '')}</strong>
                      <p>{String(datum.questionText ?? '')}</p>
                      <p>Стандартное отклонение: {Number(datum.standardDeviation ?? 0).toFixed(2)}</p>
                    </>
                  )}
                  valueKey="standardDeviation"
                  widthPerItem={52}
                />
                <ChartHelper>
                  Здесь показана вариативность ответов по вопросам. Чем выше столбец, тем сильнее расходятся ответы
                  между испытуемыми и тем больше вопрос различает профили.
                </ChartHelper>
              </section>
            </div>

            <div className="admin-section-grid">
              <section className="card page-card">
                <div className="section-header">
                  <div>
                    <span className="eyebrow">Гистограмма</span>
                    <h2>Распределение ответов по вопросу</h2>
                  </div>
                </div>

                <AnalyticsBarChart
                  categoryKey="value"
                  data={selectedQuestionDistribution}
                  tooltipContent={(datum) => (
                    <>
                      <strong>Вариант ответа {String(datum.value ?? '')}</strong>
                      <p>Частота: {String(datum.count ?? '')}</p>
                    </>
                  )}
                  valueKey="count"
                />
                <ChartHelper>
                  Эта гистограмма показывает, как часто пользователи выбирали каждый вариант ответа по выбранному
                  вопросу. По ней легко заметить перегруженные или почти неиспользуемые варианты.
                </ChartHelper>
              </section>

              <section className="card page-card">
                <div className="section-header">
                  <div>
                    <span className="eyebrow">Сводка</span>
                    <h2>Сводная таблица по вопросам</h2>
                  </div>
                </div>

                <div className="admin-table-wrap">
                  <table className="admin-table admin-table--dense">
                    <thead>
                      <tr>
                        <th>ID вопроса</th>
                        <th>№</th>
                        <th>Вопрос</th>
                        <th>Шкала</th>
                        <th>Среднее</th>
                        <th>Дисперсия</th>
                        <th>Ст. отклонение</th>
                        <th>Количество</th>
                        <th>Пропуски</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(questionStats?.questions ?? []).map((item) => (
                        <tr key={item.question_id}>
                          <td>{item.question_id}</td>
                          <td>{item.question_order}</td>
                          <td>{item.question_text}</td>
                          <td>{item.scale_name}</td>
                          <td>{item.mean_answer.toFixed(2)}</td>
                          <td>{item.variance.toFixed(2)}</td>
                          <td>{item.standard_deviation.toFixed(2)}</td>
                          <td>{item.count}</td>
                          <td>{item.missing_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </>
        ) : null}

        {!loading && activeTab === 'consistency' ? (
          <section className="card page-card">
            <div className="section-header">
              <div>
                <span className="eyebrow">Внутренняя согласованность</span>
                <h2>Внутренняя согласованность и α Кронбаха</h2>
              </div>
            </div>

            <div className="admin-controls">
              <label className="field">
                <span>Шкала</span>
                <select
                  value={selectedConsistencyScale ?? ''}
                  onChange={(event) => setSelectedConsistencyScale(event.target.value)}
                >
                  {scales.map((scale) => (
                    <option key={scale.scale_code} value={scale.scale_code}>
                      {scale.scale_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="card card--soft dashboard-grid">
              <div className="metric-item">
                <span>α Кронбаха</span>
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
            <ChartHelper>
              Этот раздел показывает, насколько вопросы внутри выбранной шкалы работают согласованно. Здесь можно
              оценить общую надежность шкалы, увидеть вклад каждого вопроса и заметить пункты, которые ослабляют
              измерение.
            </ChartHelper>

            {consistency?.message ? <div className="notice notice--info">{consistency.message}</div> : null}

            {consistency ? (
              <>
                <div className="admin-section-grid">
                  <section className="card card--soft page-card">
                    <div className="section-header">
                      <div>
                        <span className="eyebrow">Корреляция</span>
                        <h3>Корреляция вопроса с общей шкалой</h3>
                      </div>
                    </div>

                    <AnalyticsBarChart
                      categoryKey="label"
                      data={consistency.items.map((item) => ({
                        label: `Q${item.question_order}`,
                        value: item.item_total_correlation ?? 0,
                        questionText: item.question_text,
                      }))}
                      tooltipContent={(datum) => (
                        <>
                          <strong>{String(datum.label ?? '')}</strong>
                          <p>{String(datum.questionText ?? '')}</p>
                          <p>Корреляция вопроса со шкалой: {Number(datum.value ?? 0).toFixed(4)}</p>
                        </>
                      )}
                      valueDomain={['auto', 'auto']}
                      valueKey="value"
                    />
                    <ChartHelper>
                      Этот график показывает, насколько каждый вопрос согласован с общей шкалой без самого себя.
                      Низкие значения могут указывать на слабый или проблемный вопрос.
                    </ChartHelper>
                  </section>

                  <section className="card card--soft page-card">
                    <div className="section-header">
                      <div>
                        <span className="eyebrow">Надежность</span>
                        <h3>Надежность шкалы при удалении вопроса</h3>
                      </div>
                    </div>

                    <AnalyticsBarChart
                      categoryKey="label"
                      color="#5d6961"
                      data={consistency.items.map((item) => ({
                        label: `Q${item.question_order}`,
                        value: item.alpha_if_deleted ?? 0,
                        questionText: item.question_text,
                      }))}
                      tooltipContent={(datum) => (
                        <>
                          <strong>{String(datum.label ?? '')}</strong>
                          <p>{String(datum.questionText ?? '')}</p>
                          <p>α при удалении: {Number(datum.value ?? 0).toFixed(4)}</p>
                        </>
                      )}
                      valueDomain={['auto', 'auto']}
                      valueKey="value"
                    />
                    <ChartHelper>
                      Здесь показано, как изменится надежность шкалы, если убрать конкретный вопрос. Рост коэффициента
                      после удаления может указывать на проблемный пункт.
                    </ChartHelper>
                  </section>
                </div>

                <div className="admin-table-wrap">
                  <table className="admin-table admin-table--dense">
                    <thead>
                      <tr>
                        <th>Вопрос</th>
                        <th>Среднее</th>
                        <th>Дисперсия</th>
                        <th>Стандартное отклонение</th>
                        <th>Корреляция со шкалой</th>
                        <th>α при удалении</th>
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
                          <td>{item.standard_deviation.toFixed(4)}</td>
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

        {!loading && !respondents.length ? (
          <section className="card page-card page-card--centered">
            <span className="eyebrow">Аналитика</span>
            <h2>Сводка появится после первых завершённых опросов</h2>
            <p>Когда в базе накопятся прохождения, здесь появятся профили, тепловые карты и показатели надежности.</p>
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
            detailRequestIdRef.current += 1;
            setDetail(null);
            setDetailError(null);
            setDetailLoading(false);
          }}
        />
      ) : null}
    </>
  );
}
