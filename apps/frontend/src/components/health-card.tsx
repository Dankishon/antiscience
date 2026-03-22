import { APP_NAME, SURVEY_HERO_CONTENT } from '@flower-survey/shared';

const checkpoints = [
  'Next.js frontend on port 3000',
  'NestJS backend on port 4000',
  'PostgreSQL in Docker on port 5432',
];

export function HealthCard() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '32px 20px',
      }}
    >
      <section
        style={{
          width: 'min(720px, 100%)',
          backgroundColor: 'rgba(255, 255, 255, 0.82)',
          borderRadius: 24,
          padding: 32,
          boxShadow: '0 20px 80px rgba(116, 77, 28, 0.12)',
          backdropFilter: 'blur(14px)',
        }}
      >
        <p
          style={{
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            fontSize: 12,
            color: '#b26b2a',
          }}
        >
          {SURVEY_HERO_CONTENT.eyebrow}
        </p>
        <h1 style={{ marginBottom: 12, fontSize: 'clamp(2.5rem, 5vw, 4rem)' }}>
          {SURVEY_HERO_CONTENT.title}
        </h1>
        <p style={{ marginTop: 0, fontSize: 18, lineHeight: 1.6 }}>
          {SURVEY_HERO_CONTENT.description}
        </p>

        <ul style={{ paddingLeft: 20, lineHeight: 1.8 }}>
          {checkpoints.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <div
          style={{
            marginTop: 24,
            padding: 16,
            borderRadius: 18,
            backgroundColor: '#fff3df',
          }}
        >
          <strong>{APP_NAME}</strong>
          <p style={{ marginBottom: 0 }}>{SURVEY_HERO_CONTENT.ctaLabel}</p>
        </div>
      </section>
    </main>
  );
}
