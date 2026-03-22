'use client';

import { useEffect, useState } from 'react';
import { ApiClientError, getResponseResult, type ResultResponse } from '../lib/api';
import { getDictionary } from '../lib/i18n';
import { buildResultViewModel } from '../lib/result-presenter';
import { Button } from './button';
import { Card } from './card';
import { Progress } from './progress';
import { ResultChart } from './result-chart';
import { useToast } from './toast';

function buildResultError(error: unknown) {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Не удалось получить результат.';
}

export function ResultSummary({ responseId }: { responseId?: string | null }) {
  const copy = getDictionary().result;
  const { showToast } = useToast();
  const [payload, setPayload] = useState<ResultResponse | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(responseId));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!responseId) {
      setPayload(null);
      setIsLoading(false);
      return;
    }

    const loadResult = async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);
        const result = await getResponseResult(responseId);
        setPayload(result);
      } catch (error) {
        setErrorMessage(buildResultError(error));
      } finally {
        setIsLoading(false);
      }
    };

    void loadResult();
  }, [responseId]);

  if (isLoading) {
    return (
      <div className="page">
        <Card description="Получаем computed_result и scale_scores для отправленной сессии." title="Загрузка результата" tone="accent">
          <Progress hint="response_session -> result" label="Подготовка результата" max={100} value={65} />
        </Card>
      </div>
    );
  }

  if (!responseId) {
    return (
      <div className="page narrowPage">
        <Card description={copy.emptyStateDescription} title={copy.emptyStateTitle} tone="accent">
          <div className="actionRow">
            <Button href="/questionnaire">Пройти опрос</Button>
            <Button href="/" variant="ghost">
              На landing
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="page narrowPage">
        <Card description={errorMessage} title="Результат пока недоступен" tone="accent">
          <div className="actionRow">
            <Button href="/questionnaire" variant="secondary">
              Вернуться к опросу
            </Button>
            <Button href="/" variant="ghost">
              На landing
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!payload) {
    return null;
  }

  const viewModel = buildResultViewModel(payload.result, payload.submittedAt);

  return (
    <div className="page">
      <section className="pageHeader">
        <span className="eyebrow">{copy.eyebrow}</span>
        <h1 className="pageTitle">{copy.title}</h1>
        <p className="pageDescription">{copy.description}</p>
      </section>

      <div className="resultHeroGrid">
        <Card description={viewModel.mainFlower.summary} title={viewModel.mainFlower.flowerTitle} tone="accent">
          <div className="resultFlowerHero">
            <div className="resultFlowerSymbol" aria-hidden="true">
              {viewModel.mainFlower.flowerSymbol}
            </div>
            <div className="stack">
              <span className="pill">{viewModel.mainFlower.scaleTitle}</span>
              {viewModel.submittedAtLabel ? (
                <p className="supportText">
                  {copy.submittedLabel}: {viewModel.submittedAtLabel}
                </p>
              ) : null}
            </div>
          </div>

          <div className="actionRow">
            <Button href="/questionnaire" variant="secondary">
              Пройти ещё раз
            </Button>
            <Button
              onClick={() =>
                showToast({
                  title: copy.copyToast.title,
                  description: responseId
                    ? `Response session ${responseId} уже можно использовать для share/export сценариев.`
                    : copy.copyToast.description,
                })
              }
            >
              {getDictionary().common.copySummary}
            </Button>
          </div>
        </Card>

        <Card title="Сводка показателей">
          <div className="statsGrid">
            <div className="statCard">
              <strong className="statValue">{viewModel.meanLabel}</strong>
              <span className="statLabel">{copy.meanLabel}</span>
            </div>
            <div className="statCard">
              <strong className="statValue">{viewModel.standardDeviationLabel}</strong>
              <span className="statLabel">{copy.sdLabel}</span>
            </div>
            <div className="statCard">
              <strong className="statValue">{viewModel.tieBreakLabel}</strong>
              <span className="statLabel">{copy.tieLabel}</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="contentGrid">
        <Card description={copy.chartDescription} title={copy.chartTitle}>
          <ResultChart viewModel={viewModel} />
        </Card>

        <Card description={copy.interpretationDescription} title={copy.interpretationTitle}>
          <div className="stack">
            <div className="interpretationBlock">
              <span className="pill">{viewModel.interpretation.levelLabel}</span>
              <p className="supportText">
                {viewModel.interpretation.levelDescription ?? copy.fallbackInterpretation}
              </p>
            </div>

            <div className="interpretationBlock">
              <h3 className="miniTitle">{viewModel.interpretation.levelTitle}</h3>
              <p className="supportText">
                {viewModel.interpretation.levelSummary ?? viewModel.interpretation.baseSummary ?? copy.fallbackInterpretation}
              </p>
            </div>

            <div className="interpretationBlock">
              <h3 className="miniTitle">{copy.traitsTitle}</h3>
              <div className="traitGrid">
                {viewModel.interpretation.traits.length > 0 ? (
                  viewModel.interpretation.traits.slice(0, 8).map((trait) => (
                    <article className="traitCard" key={trait.code}>
                      <div className="scoreHeader">
                        <strong>{trait.label}</strong>
                        <span>{trait.polarity > 0 ? 'ресурс' : 'риск'}</span>
                      </div>
                      <p className="supportText">{trait.description}</p>
                    </article>
                  ))
                ) : (
                  <p className="supportText">{copy.fallbackInterpretation}</p>
                )}
              </div>
            </div>

            <div className="interpretationBlock">
              <h3 className="miniTitle">{copy.highlightsTitle}</h3>
              <div className="stack">
                {viewModel.highlights.map((highlight) => (
                  <div className="listRow" key={highlight.flowerCode}>
                    <div>
                      <strong>
                        {highlight.symbol} {highlight.flowerTitle}
                      </strong>
                      <p>{highlight.scaleTitle}</p>
                    </div>
                    <p>{highlight.summary ?? copy.fallbackInterpretation}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card description={copy.tableDescription} title={copy.tableTitle}>
        <div className="tableWrap">
          <table className="profileTable">
            <thead>
              <tr>
                <th>{copy.tableColumns.rank}</th>
                <th>{copy.tableColumns.scale}</th>
                <th>{copy.tableColumns.flower}</th>
                <th>{copy.tableColumns.raw}</th>
                <th>{copy.tableColumns.z}</th>
                <th>{copy.tableColumns.level}</th>
              </tr>
            </thead>
            <tbody>
              {viewModel.profileRows.map((row) => (
                <tr className={row.isMainFlower ? 'profileTableRow profileTableRow--main' : 'profileTableRow'} key={row.scaleCode}>
                  <td>{row.rank}</td>
                  <td>
                    <strong>{row.scaleTitle}</strong>
                  </td>
                  <td>
                    {row.flowerSymbol} {row.flowerTitle}
                  </td>
                  <td>{row.rawScoreLabel}</td>
                  <td>{row.zScoreLabel}</td>
                  <td>{row.levelTitle}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
