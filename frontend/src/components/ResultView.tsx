import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ResultPayload } from '../lib/api';
import {
  buildRadarProfileData,
  buildRawExpressionData,
  getRankedScaleScores,
  getTopFlowers,
} from '../lib/resultAnalytics';
import { AnalyticsBarChart, AnalyticsRadarChart } from './AnalyticsCharts';

type DisplayTrait = {
  code: string;
  label: string;
  description?: string;
};

const TIE_BREAK_COPY: Record<string, string> = {
  random_among_top:
    'У вас ярко выражены несколько цветков души. Наш алгоритм выбрал для вас главный с учетом ваших Z-оценок',
  random_among_all: 'У всех 10 цветков совпала выраженность, поэтому главный цветок был выбран случайным образом.',
  single_top: 'Главный цветок определён по максимальной Z-оценке.',
};

function formatTieBreakStrategy(strategy: string): string {
  return TIE_BREAK_COPY[strategy] ?? strategy;
}

function splitProfileSummaryIntoTraits(summary: string | null): DisplayTrait[] {
  if (!summary) {
    return [];
  }

  const groups = summary
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);

  return groups.flatMap((group, groupIndex) => {
    const commaParts = group
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

    const fragments =
      commaParts.length > 1 && commaParts.every((part) => part.split(/\s+/).length <= 3) ? commaParts : [group];

    return fragments.map((label, fragmentIndex) => ({
      code: `summary-trait-${groupIndex}-${fragmentIndex}`,
      label,
    }));
  });
}

function getDisplayTraits(result: ResultPayload): DisplayTrait[] {
  if (result.interpretation.traits.length > 0) {
    return [...result.interpretation.traits]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((trait) => ({
        code: trait.code,
        label: trait.label,
        description: trait.description,
      }));
  }

  return splitProfileSummaryIntoTraits(result.interpretation.profile_summary);
}

export function ResultView({ result }: { result: ResultPayload }) {
  const rankedScores = getRankedScaleScores(result);
  const fullProfileScores = rankedScores;
  const radarData = buildRadarProfileData(result);
  const rawExpressionData = buildRawExpressionData(result);
  const displayTraits = getDisplayTraits(result);
  const topFlowers = getTopFlowers(result);
  const tieBreakStrategyText = formatTieBreakStrategy(result.tie_break.strategy);

  return (
    <div className="result-grid">
      <section className="card card--hero result-hero">
        <div className="result-hero__main">
          <span className="eyebrow">Цветок вашей души</span>
          <div className="result-hero__flower">
            <div className="result-symbol">{result.main_flower.flower_symbol ?? '✿'}</div>
            <div>
              <h1>{result.main_flower.flower_title}</h1>
              <p>Итог сформирован на основе 30 ответов, 10 шкал и полного расчёта профиля по сырым и Z-значениям.</p>
            </div>
          </div>
        </div>

        <div className="result-hero__stats">
          <div className="metric-item">
            <span>Среднее значение</span>
            <strong>{result.mean.toFixed(2)}</strong>
          </div>
          <div className="metric-item">
            <span>Стандартное отклонение</span>
            <strong>{result.standard_deviation.toFixed(2)}</strong>
          </div>
          <div className="metric-item">
            <span>Стратегия выбора</span>
            <strong>{tieBreakStrategyText}</strong>
          </div>
        </div>

        <div className="stack-row">
          <Link className="button" to="/results">
            Открыть историю
          </Link>
          <Link className="button button--secondary" to="/questionnaire">
            Пройти ещё раз
          </Link>
        </div>
      </section>

      <section className="card page-card">
        <div className="section-header">
          <div>
            <span className="eyebrow">Профиль вашей души</span>
            <h2>Лепестковая диаграмма выраженности по всем цветкам</h2>
          </div>
        </div>

        <AnalyticsRadarChart
          data={radarData}
          labelKey="label"
          tooltipContent={(datum) => (
            <>
              <strong>{String(datum.label ?? '')}</strong>
              <p>Z-оценка: {Number(datum.zScore ?? 0).toFixed(2)}</p>
              <p>Сырой балл: {String(datum.rawScore ?? '')}</p>
            </>
          )}
          valueKey="zScore"
        />
      </section>

      <section className="card page-card">
        <div className="section-header">
          <div>
            <span className="eyebrow">Лидеры профиля</span>
            <h2>Наиболее выраженные цветки</h2>
          </div>
        </div>

        <div className="ranked-flowers">
          {topFlowers.map((flower, index) => (
            <article className="trait ranked-flower" key={flower.scale_code}>
              <span className="ranked-flower__place">{index + 1} место</span>
              <div className="history-item__flower">
                <span className="result-symbol result-symbol--small">{flower.flower_symbol ?? '✿'}</span>
                <div>
                  <strong>
                    {flower.flower_title}
                  </strong>
                  <p>{flower.scale_code.toUpperCase()}</p>
                </div>
              </div>
              <div className="ranked-flower__stats">
                <span>Сырой балл: {flower.raw_score}</span>
                <span>Z-оценка: {flower.z_score.toFixed(2)}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="card card--soft result-interpretation">
        <div className="result-interpretation__copy">
          <span className="eyebrow">Интерпретация</span>
          <h2>{result.interpretation.profile_title ?? 'Профиль'}</h2>
          <p>{result.interpretation.profile_summary ?? 'Для этого результата описание пока отсутствует.'}</p>
          {result.interpretation.z_summary ? <p>{result.interpretation.z_summary}</p> : null}
        </div>

        <div className="result-traits">
          <div className="result-traits__header">
            <span className="eyebrow">Ключевые черты</span>
          </div>

          <div className="traits result-traits__list">
            {displayTraits.length > 0 ? (
              displayTraits.map((trait) => (
                <div className={`trait${trait.description ? '' : ' trait--compact'}`} key={trait.code}>
                  <strong>{trait.label}</strong>
                  {trait.description ? <p>{trait.description}</p> : null}
                </div>
              ))
            ) : (
              <p className="result-traits__empty">Для этого результата описание пока отсутствует.</p>
            )}
          </div>
        </div>
      </section>

      <section className="card page-card">
        <div className="section-header">
          <div>
            <span className="eyebrow">Сырые значения</span>
            <h2>Выраженность всех цветков</h2>
          </div>
        </div>

        <div className="result-expression-chart">
          <ResponsiveContainer height="100%" width="100%">
            <BarChart
              barCategoryGap="22%"
              data={rawExpressionData}
              margin={{ top: 12, right: 12, bottom: 48, left: -8 }}
            >
              <CartesianGrid stroke="rgba(31, 36, 33, 0.08)" strokeDasharray="4 4" vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="flowerTitle"
                height={74}
                interval={0}
                tick={{ fill: '#5c645e', fontSize: 12 }}
                tickLine={false}
                tickMargin={12}
                angle={-24}
                textAnchor="end"
              />
              <YAxis
                allowDecimals={false}
                axisLine={false}
                domain={[0, 12]}
                tick={{ fill: '#5c645e', fontSize: 12 }}
                tickLine={false}
                tickMargin={8}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) {
                    return null;
                  }

                  const datum = payload[0]?.payload as (typeof rawExpressionData)[number];
                  return (
                    <div className="chart-tooltip">
                      <strong>{datum.flowerTitle}</strong>
                      <p>Сырой балл: {datum.rawScore}</p>
                    </div>
                  );
                }}
                cursor={{ fill: 'rgba(45, 58, 51, 0.05)' }}
              />
              <Bar dataKey="rawScore" fill="#344239" maxBarSize={52} radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="chart-helper">
          Этот график показывает сырую выраженность каждого цветка по результатам теста.
        </p>
      </section>

      <section className="card page-card result-full-profile">
        <span className="eyebrow">Полный профиль</span>
        <div className="profile-table__header profile-table__header--extended">
          <span>Ранг и цветок</span>
          <span>Сырые значения</span>
          <span>Z-оценка</span>
        </div>
        <div className="bars">
          {fullProfileScores.map((item) => (
            <div className="bar-row bar-row--extended" key={item.scale_code}>
              <div className="bar-row__label">
                <strong>
                  {item.rank}. {item.flower_symbol} {item.flower_title}
                </strong>
                <span>{item.scale_code.toUpperCase()}</span>
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(item.raw_score / 12) * 100}%` }} />
              </div>
              <strong className="bar-row__score">{item.raw_score}</strong>
              <strong className="bar-row__score">{item.z_score.toFixed(2)}</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
