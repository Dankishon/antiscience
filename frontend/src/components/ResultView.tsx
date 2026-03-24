import { Link } from 'react-router-dom';
import type { ResultPayload } from '../lib/api';

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
  const maxRaw = Math.max(...result.scale_scores.map((item) => item.raw_score), 12);
  const displayTraits = getDisplayTraits(result);
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
              <p>Итог сформирован на основе 30 ответов и 10 шкал профиля.</p>
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

      <section className="card">
        <span className="eyebrow">Полный профиль</span>
        <div className="profile-table__header">
          <span>Цветок и шкала</span>
          <span>Сырые значения</span>
        </div>
        <div className="bars">
          {result.scale_scores.map((item) => (
            <div className="bar-row" key={item.scale_code}>
              <div className="bar-row__label">
                <strong>
                  {item.flower_symbol} {item.flower_title}
                </strong>
                <span>
                  {item.scale_code.toUpperCase()} · Z {item.z_score.toFixed(2)}
                </span>
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(item.raw_score / maxRaw) * 100}%` }} />
              </div>
              <strong className="bar-row__score">{item.raw_score}</strong>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
