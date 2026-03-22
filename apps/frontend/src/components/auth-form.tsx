'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';
import { getDictionary } from '../lib/i18n';
import { Button } from './button';
import { Card } from './card';
import { useToast } from './toast';

type AuthMode = 'login' | 'register';

export function AuthForm({ mode }: { mode: AuthMode }) {
  const authCopy = getDictionary().auth;
  const pageCopy = authCopy[mode];
  const { showToast } = useToast();
  const [form, setForm] = useState({
    displayName: '',
    email: '',
    password: '',
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    showToast({
      title: pageCopy.toastTitle,
      description: pageCopy.toastDescription,
    });
  };

  return (
    <div className="page narrowPage">
      <Card description={pageCopy.description} eyebrow={pageCopy.eyebrow} title={pageCopy.title} tone="accent">
        <form className="formStack" onSubmit={handleSubmit}>
          {mode === 'register' ? (
            <label className="field">
              <span className="fieldLabel">{authCopy.fields.displayName}</span>
              <input
                className="input"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    displayName: event.target.value,
                  }))
                }
                placeholder="Как к вам обращаться"
                type="text"
                value={form.displayName}
              />
            </label>
          ) : null}

          <label className="field">
            <span className="fieldLabel">{authCopy.fields.email}</span>
            <input
              className="input"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              placeholder="you@example.com"
              type="email"
              value={form.email}
            />
          </label>

          <label className="field">
            <span className="fieldLabel">{authCopy.fields.password}</span>
            <input
              className="input"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              placeholder="••••••••"
              type="password"
              value={form.password}
            />
            <span className="fieldHint">{authCopy.fields.helper}</span>
          </label>

          <div className="actionRow">
            <Button fullWidth size="lg" type="submit">
              {pageCopy.submit}
            </Button>
            <Button fullWidth href={pageCopy.alternateHref} size="lg" variant="ghost">
              {pageCopy.alternateLabel}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
