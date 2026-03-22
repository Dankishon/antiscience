'use client';

import { useEffect, useState } from 'react';
import {
  ApiClientError,
  getAnonymousSessionRetentionPolicy,
  updateAnonymousSessionRetentionPolicy,
} from '../lib/api';
import { getDictionary } from '../lib/i18n';
import { Button } from './button';
import { Card } from './card';
import { Progress } from './progress';
import { useToast } from './toast';

export function AdminConsolePlaceholder() {
  const copy = getDictionary().admin;
  const { showToast } = useToast();
  const [authState, setAuthState] = useState<'loading' | 'ready' | 'forbidden'>('loading');
  const [retentionDays, setRetentionDays] = useState('30');
  const [lastCleanupAt, setLastCleanupAt] = useState<string | null>(null);
  const [lastDeletedCount, setLastDeletedCount] = useState(0);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isActive = true;

    const loadRetention = async () => {
      try {
        const response = await getAnonymousSessionRetentionPolicy();
        if (!isActive) {
          return;
        }

        setRetentionDays(String(response.retentionDays));
        setLastCleanupAt(response.lastCleanupAt);
        setLastDeletedCount(response.lastDeletedCount);
        setAuthState('ready');
      } catch (error) {
        if (!isActive) {
          return;
        }

        if (error instanceof ApiClientError && (error.status === 401 || error.status === 403)) {
          setAuthState('forbidden');
          return;
        }

        setInlineError(copy.retention.errors.load);
        setAuthState('forbidden');
      }
    };

    void loadRetention();

    return () => {
      isActive = false;
    };
  }, [copy.retention.errors.load]);

  const submitRetention = async (runCleanup: boolean) => {
    const parsedRetentionDays = Number(retentionDays);
    if (!Number.isInteger(parsedRetentionDays) || parsedRetentionDays < 1) {
      setInlineError(copy.retention.errors.validation);
      return;
    }

    setInlineError(null);
    setIsSaving(true);

    try {
      const response = await updateAnonymousSessionRetentionPolicy({
        retentionDays: parsedRetentionDays,
        runCleanup,
      });

      setRetentionDays(String(response.retentionDays));
      setLastCleanupAt(response.cleanup.lastCleanupAt);
      setLastDeletedCount(response.cleanup.deletedSessionsCount);
      showToast({
        title: runCleanup ? copy.retention.toastCleanup.title : copy.retention.toastSave.title,
        description: runCleanup
          ? copy.retention.toastCleanup.description.replace(
              '{count}',
              String(response.cleanup.deletedSessionsCount),
            )
          : copy.retention.toastSave.description.replace('{days}', String(response.retentionDays)),
      });
    } catch (error) {
      setInlineError(error instanceof Error ? error.message : copy.retention.errors.save);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="page">
      <section className="pageHeader">
        <span className="eyebrow">{copy.eyebrow}</span>
        <h1 className="pageTitle">{copy.title}</h1>
        <p className="pageDescription">{copy.description}</p>
      </section>

      <Card description={copy.readinessHint} title="Admin roadmap" tone="accent">
        <Progress hint={copy.readinessHint} label={copy.readinessLabel} max={5} value={3} />
      </Card>

      <Card description={copy.retention.description} title={copy.retention.title}>
        <div className="stack">
          {inlineError ? <div className="inlineError">{inlineError}</div> : null}
          {authState === 'loading' ? <p className="supportText">{copy.retention.loading}</p> : null}
          {authState === 'forbidden' ? (
            <p className="supportText">{copy.retention.forbidden}</p>
          ) : (
            <>
              <label className="field">
                <span className="fieldLabel">{copy.retention.label}</span>
                <input
                  className="input"
                  min={1}
                  onChange={(event) => setRetentionDays(event.target.value)}
                  type="number"
                  value={retentionDays}
                />
              </label>
              <div className="pillRow">
                <span className="pill">
                  {copy.retention.lastDeletedLabel.replace('{count}', String(lastDeletedCount))}
                </span>
                <span className="pill">
                  {copy.retention.lastCleanupLabel.replace('{value}', lastCleanupAt ?? copy.retention.never)}
                </span>
              </div>
              <div className="actionRow">
                <Button disabled={isSaving} onClick={() => void submitRetention(false)} variant="secondary">
                  {copy.retention.saveAction}
                </Button>
                <Button disabled={isSaving} onClick={() => void submitRetention(true)}>
                  {copy.retention.cleanupAction}
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>

      <div className="cardGrid">
        {copy.cards.map((item) => (
          <Card
            description={item.description}
            footer={
              <Button disabled variant="ghost">
                {getDictionary().common.planned}
              </Button>
            }
            key={item.title}
            title={item.title}
          />
        ))}
      </div>
    </div>
  );
}
