import { Link } from 'react-router-dom';
import type { ResultPayload } from '../lib/api';

export function ResultView({ result }: { result: ResultPayload }) {
  const maxRaw = Math.max(...result.scale_scores.map((item) => item.raw_score), 12);

  return (
    <div className="result-grid">
      <section className="card card--hero result-hero">
        <div className="result-hero__main">
          <span className="eyebrow">Главный цветок</span>
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
            <strong>{result.tie_break.strategy}</strong>
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

      <section className="card card--soft">
        <span className="eyebrow">Интерпретация</span>
        <h2>{result.interpretation.profile_title ?? 'Профиль'}</h2>
        <p>{result.interpretation.profile_summary ?? 'Для этого результата описание пока отсутствует.'}</p>
        {result.interpretation.z_summary ? <p>{result.interpretation.z_summary}</p> : null}
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

      <section className="card card--soft">
        <span className="eyebrow">Ключевые черты</span>
        <div className="traits">
          {result.interpretation.traits.length > 0 ? (
            result.interpretation.traits.map((trait) => (
              <div className="trait" key={trait.code}>
                <strong>{trait.label}</strong>
                <p>{trait.description}</p>
              </div>
            ))
          ) : (
            <p>Для этого цветка черты пока не указаны в исходном материале.</p>
          )}
        </div>
      </section>
    </div>
  );
}
