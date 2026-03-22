'use client';

import { useEffect, useState } from 'react';
import {
  ApiClientError,
  deleteMyData,
  getCurrentUser,
  getMyDataExport,
  logoutUser,
  type AuthUserResponse,
} from '../lib/api';
import { getDictionary } from '../lib/i18n';
import { Button } from './button';
import { Card } from './card';
import { Modal } from './modal';
import { useToast } from './toast';

export function AccountOverview() {
  const copy = getDictionary().account;
  const { showToast } = useToast();
  const [authState, setAuthState] = useState<'loading' | 'ready' | 'unauthorized'>('loading');
  const [currentUser, setCurrentUser] = useState<AuthUserResponse['user'] | null>(null);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadMe = async () => {
      try {
        const response = await getCurrentUser();
        if (!isActive) {
          return;
        }

        setCurrentUser(response.user);
        setAuthState('ready');
      } catch (error) {
        if (!isActive) {
          return;
        }

        if (error instanceof ApiClientError && error.status === 401) {
          setAuthState('unauthorized');
          setCurrentUser(null);
          return;
        }

        setInlineError(copy.errors.load);
        setAuthState('unauthorized');
      }
    };

    void loadMe();

    return () => {
      isActive = false;
    };
  }, [copy.errors.load]);

  const sessionSummary =
    authState === 'ready' && currentUser
      ? [
          `${copy.stats.sessions}: ${copy.stats.identifiedOnly}`,
          `${copy.stats.exportIncludes}: ${copy.stats.exportItems.join(', ')}`,
        ]
      : authState === 'loading'
        ? [copy.loading]
        : [copy.unauthorized.description];

  const handleDownload = async () => {
    setInlineError(null);
    setIsBusy(true);

    try {
      const response = await getMyDataExport();
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const headerValue = response.headers.get('content-disposition');
      const fileName =
        headerValue?.match(/filename="?([^"]+)"?/)?.[1] ?? `flower-survey-me-export-${Date.now()}.json`;

      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);

      showToast(copy.downloadToast);
    } catch (error) {
      setInlineError(error instanceof Error ? error.message : copy.errors.download);
    } finally {
      setIsBusy(false);
    }
  };

  const handleLogout = async () => {
    setInlineError(null);
    setIsBusy(true);

    try {
      await logoutUser();
      setCurrentUser(null);
      setAuthState('unauthorized');
      setIsLogoutOpen(false);
      showToast(copy.logoutToast);
    } catch (error) {
      setInlineError(error instanceof Error ? error.message : copy.errors.logout);
    } finally {
      setIsBusy(false);
    }
  };

  const handleDelete = async () => {
    setInlineError(null);
    setIsBusy(true);

    try {
      const response = await deleteMyData({
        confirmation: 'DELETE',
        reason: 'frontend_self_service',
      });

      setCurrentUser(null);
      setAuthState('unauthorized');
      setDeleteConfirmation('');
      setIsDeleteOpen(false);
      showToast({
        title: copy.deleteToast.title,
        description: copy.deleteToast.description.replace('{count}', String(response.deletedResponseSessionsCount)),
      });
    } catch (error) {
      setInlineError(error instanceof Error ? error.message : copy.errors.delete);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="page">
      <section className="pageHeader">
        <span className="eyebrow">{copy.eyebrow}</span>
        <h1 className="pageTitle">{copy.title}</h1>
        <p className="pageDescription">{copy.description}</p>
      </section>

      <div className="contentGrid">
        <Card
          description={currentUser?.email ?? copy.unauthorized.email}
          title={currentUser?.displayName ?? copy.profile.name}
          tone="accent"
        >
          <div className="stack">
            <span className="pill">{currentUser ? currentUser.roles.join(', ') : copy.unauthorized.badge}</span>
            <div className="actionRow">
              <Button disabled={authState !== 'ready' || isBusy} onClick={handleDownload} variant="secondary">
                {copy.downloadAction}
              </Button>
              <Button disabled={authState !== 'ready' || isBusy} onClick={() => setIsLogoutOpen(true)}>
                {copy.logoutAction}
              </Button>
            </div>
          </div>
        </Card>

        <Card title={copy.privacyTitle}>
          <div className="stack">
            {inlineError ? <div className="inlineError">{inlineError}</div> : null}
            {authState === 'loading' ? <p className="supportText">{copy.loading}</p> : null}
            {sessionSummary.map((item) => (
              <div className="listRow" key={item}>
                <strong>{copy.dataCardTitle}</strong>
                <p>{item}</p>
              </div>
            ))}
            <div className="actionRow">
              <Button disabled={authState !== 'ready' || isBusy} onClick={() => setIsDeleteOpen(true)} variant="ghost">
                {copy.deleteAction}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {authState === 'unauthorized' ? (
        <Card description={copy.unauthorized.description} title={copy.unauthorized.title} tone="muted">
          <div className="actionRow">
            <Button href="/login" size="lg">
              {copy.unauthorized.primaryAction}
            </Button>
            <Button href="/register" size="lg" variant="ghost">
              {copy.unauthorized.secondaryAction}
            </Button>
          </div>
        </Card>
      ) : null}

      <Modal
        description={copy.modal.description}
        footer={
          <div className="actionRow">
            <Button disabled={isBusy} onClick={() => setIsLogoutOpen(false)} variant="ghost">
              Отмена
            </Button>
            <Button disabled={isBusy} onClick={handleLogout}>
              {copy.modal.confirm}
            </Button>
          </div>
        }
        onClose={() => setIsLogoutOpen(false)}
        open={isLogoutOpen}
        title={copy.modal.title}
      >
        <p className="supportText">{copy.modal.helper}</p>
      </Modal>

      <Modal
        description={copy.deleteModal.description}
        footer={
          <div className="actionRow">
            <Button
              disabled={isBusy}
              onClick={() => {
                setIsDeleteOpen(false);
                setDeleteConfirmation('');
              }}
              variant="ghost"
            >
              {copy.deleteModal.cancel}
            </Button>
            <Button disabled={deleteConfirmation !== 'DELETE' || isBusy} onClick={handleDelete}>
              {copy.deleteModal.confirm}
            </Button>
          </div>
        }
        onClose={() => {
          setIsDeleteOpen(false);
          setDeleteConfirmation('');
        }}
        open={isDeleteOpen}
        title={copy.deleteModal.title}
      >
        <div className="stack">
          <p className="supportText">{copy.deleteModal.helper}</p>
          <label className="field">
            <span className="fieldLabel">{copy.deleteModal.label}</span>
            <input
              className="input"
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              placeholder="DELETE"
              type="text"
              value={deleteConfirmation}
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}
