import type { ResultPayload } from '../lib/api';

export function ResultView({ result }: { result: ResultPayload }) {
  const maxRaw = Math.max(...result.scale_scores.map((item) => item.raw_score), 12);

  return (
    <div className="result-grid">
      <section className="card card--hero">
        <span className="eyebrow">Главный цветок</span>
        <h1>
          {result.main_flower.flower_symbol} {result.main_flower.flower_title}
        </h1>
        <p>
          Среднее: <strong>{result.mean.toFixed(2)}</strong> · SD: <strong>{result.standard_deviation.toFixed(2)}</strong>
        </p>
        <p>
          Стратегия выбора: <strong>{result.tie_break.strategy}</strong>
        </p>
      </section>

      <section className="card">
        <span className="eyebrow">Интерпретация</span>
        <h2>{result.interpretation.profile_title ?? 'Профиль'}</h2>
        <p>{result.interpretation.profile_summary ?? 'Для этого результата описание пока отсутствует.'}</p>
        {result.interpretation.z_summary ? <p>{result.interpretation.z_summary}</p> : null}
      </section>

      <section className="card">
        <span className="eyebrow">Полный профиль</span>
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
              <strong>{item.raw_score}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
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
