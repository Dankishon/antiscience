'use client';

import { SURVEY_HERO_CONTENT } from '@flower-survey/shared';
import { useState } from 'react';
import { getDictionary } from '../lib/i18n';
import { Button } from './button';
import { Card } from './card';
import { Modal } from './modal';
import { Progress } from './progress';

export function LandingShowcase() {
  const copy = getDictionary().landing;
  const [isFlowOpen, setIsFlowOpen] = useState(false);

  return (
    <div className="page">
      <section className="heroGrid">
        <div className="heroCopy">
          <span className="eyebrow">{copy.eyebrow}</span>
          <h1 className="pageTitle">{copy.title}</h1>
          <p className="pageDescription">{copy.description}</p>

          <div className="actionRow">
            <Button href="/questionnaire" size="lg">
              {copy.primaryAction}
            </Button>
            <Button onClick={() => setIsFlowOpen(true)} size="lg" variant="secondary">
              {copy.secondaryAction}
            </Button>
          </div>

          <div className="pillRow">
            <span className="pill">Next.js App Router</span>
            <span className="pill">i18n-ready ru</span>
            <span className="pill">Theme tokens</span>
          </div>
        </div>

        <Card
          description={copy.statsDescription}
          eyebrow={SURVEY_HERO_CONTENT.eyebrow}
          title={copy.statsTitle}
          tone="accent"
        >
          <Progress className="spacedProgress" hint={copy.progressHint} label={copy.progressLabel} max={10} value={8} />
          <div className="statsGrid">
            {copy.stats.map((stat) => (
              <div className="statCard" key={stat.label}>
                <strong className="statValue">{stat.value}</strong>
                <span className="statLabel">{stat.label}</span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="sectionStack">
        <div className="sectionHeading">
          <span className="eyebrow">Component-first pages</span>
          <h2 className="sectionTitle">Маршруты уже распределены по пользовательским задачам.</h2>
        </div>

        <div className="cardGrid">
          {copy.features.map((feature) => (
            <Card description={feature.description} key={feature.title} title={feature.title} tone="muted" />
          ))}
        </div>
      </section>

      <section className="sectionStack">
        <div className="sectionHeading">
          <span className="eyebrow">Route preview</span>
          <h2 className="sectionTitle">Каждая ключевая страница уже доступна как рабочий skeleton.</h2>
        </div>

        <div className="cardGrid">
          {copy.routeCards.map((routeCard) => (
            <Card
              description={routeCard.description}
              footer={
                <Button href={routeCard.href} variant="ghost">
                  Перейти
                </Button>
              }
              key={routeCard.href}
              title={routeCard.title}
            />
          ))}
        </div>
      </section>

      <Modal
        description={copy.modal.description}
        footer={
          <Button onClick={() => setIsFlowOpen(false)} variant="secondary">
            {copy.modal.closeAction}
          </Button>
        }
        onClose={() => setIsFlowOpen(false)}
        open={isFlowOpen}
        title={copy.modal.title}
      >
        <ol className="numberList">
          {copy.flowSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </Modal>
    </div>
  );
}
