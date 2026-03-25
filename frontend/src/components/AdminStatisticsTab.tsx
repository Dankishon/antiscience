import { useMemo, useState } from 'react';
import {
  type StatisticsCluster,
  type StatisticsPayload,
} from '../lib/api';
import { AnalyticsBarChart, AnalyticsLineChart, AnalyticsRadarChart } from './AnalyticsCharts';

type StatisticsHeatmapMode = 'raw' | 'external-z' | 'correlation';
type StatisticsExportSection = 'overview' | 'reliability' | 'factor-analysis' | 'clusters';

function ChartHelper({ children }: { children: string }) {
  return <p className="chart-helper">{children}</p>;
}

function formatNumber(value: number | null | undefined, digits = 2): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }
  return value.toFixed(digits);
}

function StatisticsHeatmapTable({
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
  mode: StatisticsHeatmapMode;
}) {
  const getCellStyle = (value: number | null | undefined) => {
    if (typeof value !== 'number') {
      return undefined;
    }

    if (mode === 'raw') {
      const alpha = 0.1 + Math.min(1, value / 12) * 0.5;
      return {
        background: `rgba(45, 58, 51, ${alpha})`,
        color: alpha > 0.42 ? '#f7f7f3' : 'var(--text)',
      };
    }

    if (mode === 'external-z') {
      const intensity = Math.min(1, Math.abs(value) / 3);
      const alpha = 0.1 + intensity * 0.5;
      return {
        background: value >= 0 ? `rgba(45, 58, 51, ${alpha})` : `rgba(142, 84, 70, ${alpha})`,
        color: intensity > 0.48 ? '#f7f7f3' : 'var(--text)',
      };
    }

    const intensity = Math.min(1, Math.abs(value));
    const alpha = 0.08 + intensity * 0.52;
    return {
      background: value >= 0 ? `rgba(45, 58, 51, ${alpha})` : `rgba(142, 84, 70, ${alpha})`,
      color: intensity > 0.48 ? '#f7f7f3' : 'var(--text)',
    };
  };

  const formatCell = (value: number | null | undefined) => {
    if (typeof value !== 'number') {
      return '—';
    }
    if (mode === 'raw') {
      return String(Math.round(value));
    }
    return value.toFixed(2);
  };

  return (
    <div className="heatmap-wrap">
      <table className="heatmap-table">
        <thead>
          <tr>
            <th>Профиль</th>
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
                    {formatCell(cell.value)}
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

function buildClusterRadarData(cluster: StatisticsCluster | null) {
  if (!cluster) {
    return [];
  }

  return cluster.mean_profile.map((point) => ({
    label: point.short_code,
    scaleName: point.scale_name,
    externalZ: point.mean_external_z_score,
    rawScore: point.mean_raw_score,
  }));
}

export function AdminStatisticsTab({
  payload,
  loading,
  error,
  getExportUrl,
}: {
  payload: StatisticsPayload | null;
  loading: boolean;
  error: string | null;
  getExportUrl: (section: StatisticsExportSection, format: 'csv' | 'json') => string;
}) {
  const [normalizationMode, setNormalizationMode] = useState<'raw' | 'external-z'>('raw');
  const [exportSection, setExportSection] = useState<StatisticsExportSection>('overview');
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);

  const selectedCluster = useMemo(() => {
    const clusters = payload?.clusters.clusters ?? [];
    return clusters.find((cluster) => cluster.cluster_id === selectedClusterId) ?? clusters[0] ?? null;
  }, [payload?.clusters.clusters, selectedClusterId]);

  const normalizationHeatmapRows = useMemo(
    () =>
      (payload?.overview.respondents ?? []).map((respondent) => ({
        id: respondent.session_id,
        label: respondent.respondent_label,
        values: (payload?.overview.scales ?? []).map((scale) => ({
          key: scale.scale_code,
          value:
            normalizationMode === 'raw'
              ? respondent.raw_scores_by_scale[scale.scale_code]
              : respondent.external_z_scores_by_scale[scale.scale_code],
        })),
      })),
    [normalizationMode, payload?.overview.respondents, payload?.overview.scales],
  );

  const reliabilityChartData = useMemo(
    () =>
      (payload?.reliability.scales ?? []).map((scale) => ({
        label: scale.short_code,
        scaleName: scale.scale_name,
        alpha: scale.cronbach_alpha ?? 0,
        interpretation: scale.interpretation,
      })),
    [payload?.reliability.scales],
  );

  const screeData = useMemo(
    () =>
      (payload?.factor_analysis.components ?? []).map((component) => ({
        label: component.component_key,
        eigenvalue: component.eigenvalue,
        explainedVariance: component.explained_variance_ratio * 100,
      })),
    [payload?.factor_analysis.components],
  );

  const factorHeatmapRows = useMemo(
    () =>
      (payload?.factor_analysis.correlation_matrix ?? []).map((row) => ({
        id: row.scale_code,
        label: row.scale_name,
        values: row.values.map((value) => ({ key: value.scale_code, value: value.value })),
      })),
    [payload?.factor_analysis.correlation_matrix],
  );

  const clusterDistributionData = useMemo(
    () =>
      (payload?.clusters.clusters ?? []).map((cluster) => ({
        label: cluster.label,
        size: cluster.size,
      })),
    [payload?.clusters.clusters],
  );

  const clusterHeatmapRows = useMemo(
    () =>
      (payload?.clusters.clusters ?? []).map((cluster) => ({
        id: cluster.cluster_id,
        label: cluster.label,
        values: cluster.mean_profile.map((point) => ({
          key: point.scale_code,
          value: point.mean_external_z_score,
        })),
      })),
    [payload?.clusters.clusters],
  );

  const clusterRadarData = useMemo(() => buildClusterRadarData(selectedCluster), [selectedCluster]);

  if (loading) {
    return (
      <section className="card page-card page-card--centered">
        <span className="eyebrow">Психометрика</span>
        <h2>Загружаем статистический слой</h2>
        <p>Собираем внешнее нормирование, показатели надежности, факторную структуру и кластерные профили.</p>
      </section>
    );
  }

  if (error) {
    return <div className="notice notice--error">{error}</div>;
  }

  if (!payload) {
    return (
      <section className="card page-card page-card--centered">
        <span className="eyebrow">Психометрика</span>
        <h2>Статистические данные пока недоступны</h2>
        <p>После загрузки аналитики здесь появятся расчёты по выборке, надежности шкал, PCA и кластеризации.</p>
      </section>
    );
  }

  return (
    <div className="stats-section-stack">
      <section className="card card--soft page-card">
        <div className="section-header">
          <div>
            <span className="eyebrow">Психометрика</span>
            <h2>Статистический слой опросника по выборке</h2>
          </div>
        </div>

        <div className="admin-controls">
          <label className="field">
            <span>Экспорт раздела</span>
            <select value={exportSection} onChange={(event) => setExportSection(event.target.value as StatisticsExportSection)}>
              <option value="overview">Нормирование</option>
              <option value="reliability">Надёжность</option>
              <option value="factor-analysis">Факторная структура</option>
              <option value="clusters">Кластеры</option>
            </select>
          </label>

          <a className="button" href={getExportUrl(exportSection, 'csv')} rel="noreferrer" target="_blank">
            CSV
          </a>
          <a className="button button--secondary" href={getExportUrl(exportSection, 'json')} rel="noreferrer" target="_blank">
            JSON
          </a>
        </div>
      </section>

      <section className="card page-card">
        <div className="section-header">
          <div>
            <span className="eyebrow">Нормирование</span>
            <h2>Внешнее нормирование по выборке</h2>
          </div>
        </div>
        <ChartHelper>
          Внешнее нормирование сравнивает не шкалы внутри одного человека, а каждого испытуемого с общей выборкой.
          Это делает Z-оценки сопоставимыми между разными людьми и создаёт основу для устойчивой психометрики.
        </ChartHelper>

        {payload.overview.message ? <div className="notice notice--info">{payload.overview.message}</div> : null}

        <div className="dashboard-grid">
          <div className="metric-item">
            <span>Завершённых прохождений</span>
            <strong>{payload.overview.respondents_count}</strong>
          </div>
          <div className="metric-item">
            <span>Шкал в нормировании</span>
            <strong>{payload.overview.scales.length}</strong>
          </div>
          <div className="metric-item">
            <span>Режим просмотра</span>
            <strong>{normalizationMode === 'raw' ? 'Сырые баллы' : 'Z по выборке'}</strong>
          </div>
        </div>

        <div className="admin-controls">
          <label className="field">
            <span>Показать значения</span>
            <select value={normalizationMode} onChange={(event) => setNormalizationMode(event.target.value as 'raw' | 'external-z')}>
              <option value="raw">Сырые баллы</option>
              <option value="external-z">Z по выборке</option>
            </select>
          </label>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table admin-table--dense">
            <thead>
              <tr>
                <th>Шкала</th>
                <th>Цветок</th>
                <th>M по выборке</th>
                <th>SD по выборке</th>
                <th>Min</th>
                <th>Max</th>
                <th>n</th>
              </tr>
            </thead>
            <tbody>
              {payload.overview.scales.map((scale) => (
                <tr key={scale.scale_code}>
                  <td>
                    <strong>{scale.scale_name}</strong>
                    <div className="admin-subtext">{scale.short_code}</div>
                  </td>
                  <td>
                    {scale.flower_symbol} {scale.flower_title}
                  </td>
                  <td>{formatNumber(scale.sample_mean_raw)}</td>
                  <td>{formatNumber(scale.sample_standard_deviation_raw)}</td>
                  <td>{formatNumber(scale.min_raw)}</td>
                  <td>{formatNumber(scale.max_raw)}</td>
                  <td>{scale.respondents_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <StatisticsHeatmapTable
          columns={payload.overview.scales.map((scale) => ({ key: scale.scale_code, label: scale.short_code }))}
          mode={normalizationMode === 'raw' ? 'raw' : 'external-z'}
          rows={normalizationHeatmapRows}
        />
        <ChartHelper>
          Таблица-heatmap показывает профили испытуемых по всем шкалам. В режиме Z по выборке видно, насколько
          человек отклоняется от среднего по общей выборке, а не от собственного внутреннего среднего.
        </ChartHelper>
      </section>

      <section className="card page-card">
        <div className="section-header">
          <div>
            <span className="eyebrow">Надёжность шкал</span>
            <h2>Альфа Кронбаха и вклад вопросов</h2>
          </div>
        </div>
        <ChartHelper>
          Альфа Кронбаха показывает, насколько согласованы вопросы внутри одной шкалы. Чем выше коэффициент, тем
          надёжнее шкала измеряет единый конструкт, а item-total correlation помогает находить слабые вопросы.
        </ChartHelper>

        {payload.reliability.message ? <div className="notice notice--info">{payload.reliability.message}</div> : null}

        <AnalyticsBarChart
          categoryKey="label"
          data={reliabilityChartData}
          tooltipContent={(datum) => (
            <>
              <strong>{String(datum.scaleName ?? '')}</strong>
              <p>α Кронбаха: {formatNumber(Number(datum.alpha ?? 0), 4)}</p>
              <p>Оценка: {String(datum.interpretation ?? '')}</p>
            </>
          )}
          valueDomain={[0, 1]}
          valueKey="alpha"
          widthPerItem={76}
        />

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Шкала</th>
                <th>Цветок</th>
                <th>α Кронбаха</th>
                <th>Интерпретация</th>
                <th>Вопросов</th>
                <th>n</th>
              </tr>
            </thead>
            <tbody>
              {payload.reliability.scales.map((scale) => (
                <tr key={scale.scale_code}>
                  <td>{scale.scale_name}</td>
                  <td>
                    {scale.flower_symbol} {scale.flower_title}
                  </td>
                  <td>{scale.cronbach_alpha !== null ? scale.cronbach_alpha.toFixed(4) : '—'}</td>
                  <td>{scale.interpretation}</td>
                  <td>{scale.questions_count}</td>
                  <td>{scale.respondents_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table admin-table--dense">
            <thead>
              <tr>
                <th>Шкала</th>
                <th>№</th>
                <th>Вопрос</th>
                <th>Среднее</th>
                <th>Дисперсия</th>
                <th>Ст. отклонение</th>
                <th>Item-total corr</th>
                <th>α if deleted</th>
              </tr>
            </thead>
            <tbody>
              {payload.reliability.items.map((item) => (
                <tr key={item.question_id}>
                  <td>{item.scale_name}</td>
                  <td>{item.question_order}</td>
                  <td>{item.question_text}</td>
                  <td>{formatNumber(item.mean, 4)}</td>
                  <td>{formatNumber(item.variance, 4)}</td>
                  <td>{formatNumber(item.standard_deviation, 4)}</td>
                  <td>{item.item_total_correlation !== null ? item.item_total_correlation.toFixed(4) : '—'}</td>
                  <td>{item.alpha_if_deleted !== null ? item.alpha_if_deleted.toFixed(4) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card page-card">
        <div className="section-header">
          <div>
            <span className="eyebrow">Факторная структура</span>
            <h2>PCA, корреляции и scree plot</h2>
          </div>
        </div>
        <ChartHelper>
          PCA показывает, сколько скрытых компонент действительно содержится в шкалах и какие цветки “ходят вместе”.
          Scree plot помогает понять, сколько компонент имеет смысл интерпретировать, а корреляционная матрица
          показывает силу связи между шкалами.
        </ChartHelper>

        {payload.factor_analysis.message ? <div className="notice notice--info">{payload.factor_analysis.message}</div> : null}

        <div className="dashboard-grid">
          <div className="metric-item">
            <span>Испытуемых в PCA</span>
            <strong>{payload.factor_analysis.respondents_count}</strong>
          </div>
          <div className="metric-item">
            <span>Рекомендовано компонент</span>
            <strong>{payload.factor_analysis.recommended_components ?? '—'}</strong>
          </div>
          <div className="metric-item">
            <span>Исключено шкал</span>
            <strong>{payload.factor_analysis.excluded_scale_codes.length}</strong>
          </div>
        </div>

        {payload.factor_analysis.components.length > 0 ? (
          <>
            <AnalyticsLineChart
              categoryKey="label"
              data={screeData}
              tooltipContent={(datum) => (
                <>
                  <strong>{String(datum.label ?? '')}</strong>
                  <p>Собственное значение: {formatNumber(Number(datum.eigenvalue ?? 0), 4)}</p>
                  <p>Explained variance: {formatNumber(Number(datum.explainedVariance ?? 0), 2)}%</p>
                </>
              )}
              valueKey="eigenvalue"
              widthPerItem={78}
            />

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Компонента</th>
                    <th>Eigenvalue</th>
                    <th>Explained variance</th>
                    <th>Cumulative</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.factor_analysis.components.map((component) => (
                    <tr key={component.component_key}>
                      <td>{component.component_key}</td>
                      <td>{component.eigenvalue.toFixed(4)}</td>
                      <td>{(component.explained_variance_ratio * 100).toFixed(2)}%</td>
                      <td>{(component.cumulative_explained_variance_ratio * 100).toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}

        <StatisticsHeatmapTable
          columns={payload.factor_analysis.correlation_matrix.map((row) => ({
            key: row.scale_code,
            label: row.scale_code.toUpperCase(),
          }))}
          mode="correlation"
          rows={factorHeatmapRows}
        />

        {payload.factor_analysis.loadings.length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--dense">
              <thead>
                <tr>
                  <th>Шкала</th>
                  {Array.from(
                    { length: payload.factor_analysis.recommended_components ?? 0 },
                    (_, index) => (
                      <th key={`loading-head-${index}`}>PC{index + 1}</th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {payload.factor_analysis.loadings.map((item) => (
                  <tr key={item.scale_code}>
                    <td>
                      <strong>{item.scale_name}</strong>
                      <div className="admin-subtext">{item.short_code}</div>
                    </td>
                    {item.loadings.map((value, index) => (
                      <td key={`${item.scale_code}-loading-${index}`}>{value !== null ? value.toFixed(4) : '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="card page-card">
        <div className="section-header">
          <div>
            <span className="eyebrow">Типология</span>
            <h2>Кластеризация профилей по шкалам</h2>
          </div>
        </div>
        <ChartHelper>
          Кластеризация группирует похожие профили, чтобы увидеть повторяющиеся паттерны. Это не диагноз, а способ
          исследовательски описать типы профилей, которые часто встречаются в выборке.
        </ChartHelper>

        {payload.clusters.message ? <div className="notice notice--info">{payload.clusters.message}</div> : null}

        <div className="dashboard-grid">
          <div className="metric-item">
            <span>Кластеров</span>
            <strong>{payload.clusters.cluster_count}</strong>
          </div>
          <div className="metric-item">
            <span>Silhouette score</span>
            <strong>{payload.clusters.silhouette_score !== null ? payload.clusters.silhouette_score.toFixed(4) : '—'}</strong>
          </div>
          <div className="metric-item">
            <span>Испытуемых</span>
            <strong>{payload.clusters.respondents_count}</strong>
          </div>
        </div>

        {payload.clusters.clusters.length > 0 ? (
          <>
            <AnalyticsBarChart
              categoryKey="label"
              data={clusterDistributionData}
              tooltipContent={(datum) => (
                <>
                  <strong>{String(datum.label ?? '')}</strong>
                  <p>Размер кластера: {String(datum.size ?? '')}</p>
                </>
              )}
              valueKey="size"
            />

            <div className="admin-controls">
              <label className="field">
                <span>Профиль кластера</span>
                <select value={selectedCluster?.cluster_id ?? ''} onChange={(event) => setSelectedClusterId(event.target.value)}>
                  {payload.clusters.clusters.map((cluster) => (
                    <option key={cluster.cluster_id} value={cluster.cluster_id}>
                      {cluster.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {selectedCluster ? (
              <div className="admin-section-grid">
                <section className="card card--soft page-card">
                  <div className="section-header">
                    <div>
                      <span className="eyebrow">Профиль кластера</span>
                      <h3>{selectedCluster.label}</h3>
                    </div>
                  </div>

                  <AnalyticsRadarChart
                    data={clusterRadarData}
                    labelKey="label"
                    tooltipContent={(datum) => (
                      <>
                        <strong>{String(datum.scaleName ?? '')}</strong>
                        <p>Средний сырой балл: {formatNumber(Number(datum.rawScore ?? 0), 2)}</p>
                        <p>Средний внешний Z: {formatNumber(Number(datum.externalZ ?? 0), 2)}</p>
                      </>
                    )}
                    valueKey="externalZ"
                  />
                  <ChartHelper>
                    Радар-профиль показывает среднее положение выбранного кластера по шкалам. Он помогает быстро
                    увидеть, какие цветки формируют характерный паттерн этого типа профиля.
                  </ChartHelper>
                </section>

                <section className="card card--soft page-card">
                  <div className="section-header">
                    <div>
                      <span className="eyebrow">Доминирующие цветки</span>
                      <h3>Сводка по кластеру</h3>
                    </div>
                  </div>
                  <div className="metric-list">
                    <div className="metric-item">
                      <span>Размер</span>
                      <strong>{selectedCluster.size}</strong>
                    </div>
                    <div className="metric-item">
                      <span>Доминирующие цветки</span>
                      <strong>{selectedCluster.dominant_flowers.join(', ')}</strong>
                    </div>
                  </div>
                </section>
              </div>
            ) : null}

            <StatisticsHeatmapTable
              columns={payload.overview.scales.map((scale) => ({ key: scale.scale_code, label: scale.short_code }))}
              mode="external-z"
              rows={clusterHeatmapRows}
            />

            <div className="admin-table-wrap">
              <table className="admin-table admin-table--dense">
                <thead>
                  <tr>
                    <th>Кластер</th>
                    <th>Размер</th>
                    <th>Доминирующие цветки</th>
                    <th>Ведущий профиль</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.clusters.clusters.map((cluster) => (
                    <tr key={cluster.cluster_id}>
                      <td>{cluster.label}</td>
                      <td>{cluster.size}</td>
                      <td>{cluster.dominant_flowers.join(', ')}</td>
                      <td>
                        {cluster.mean_profile
                          .slice()
                          .sort((left, right) => right.mean_external_z_score - left.mean_external_z_score)
                          .slice(0, 3)
                          .map((point) => `${point.short_code} ${point.mean_external_z_score.toFixed(2)}`)
                          .join(' · ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
