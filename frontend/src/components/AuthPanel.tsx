import { useState } from 'react';
import type { User } from '../lib/api';

interface AuthPanelProps {
  onGuest: () => Promise<void>;
  onLogin: (username: string, password: string) => Promise<User>;
  onRegister: (username: string, password: string) => Promise<User>;
}

export function AuthPanel({ onGuest, onLogin, onRegister }: AuthPanelProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isSubmitDisabled = busy || username.trim().length < 3 || password.length < 8;

  const submit = async () => {
    setBusy(true);
    setError(null);

    try {
      if (mode === 'login') {
        await onLogin(username, password);
      } else {
        await onRegister(username, password);
      }
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Не удалось выполнить вход');
    } finally {
      setBusy(false);
    }
  };

  const handleGuest = async () => {
    setBusy(true);
    setError(null);

    try {
      await onGuest();
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Не удалось создать гостевую сессию');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card auth-card">
      <div className="tabs">
        <button
          className={mode === 'login' ? 'tab tab--active' : 'tab'}
          onClick={() => setMode('login')}
          type="button"
        >
          Вход
        </button>
        <button
          className={mode === 'register' ? 'tab tab--active' : 'tab'}
          onClick={() => setMode('register')}
          type="button"
        >
          Регистрация
        </button>
      </div>

      <div className="auth-card__intro">
        <h2>{mode === 'login' ? 'Добро пожаловать' : 'Создание аккаунта'}</h2>
        <p>
          {mode === 'login'
            ? 'Используйте имя пользователя и пароль, чтобы открыть личный кабинет и историю результатов.'
            : 'Создайте аккуратный профиль без лишних полей и начните опрос в одном потоке.'}
        </p>
      </div>

      <label className="field">
        <span>Имя пользователя</span>
        <input
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Введите имя пользователя"
          type="text"
          value={username}
        />
      </label>

      <label className="field">
        <span>Пароль</span>
        <input
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Минимум 8 символов"
          type="password"
          value={password}
        />
      </label>

      {error ? <div className="notice notice--error">{error}</div> : null}

      <div className="stack-row">
        <button className="button" disabled={isSubmitDisabled} onClick={() => void submit()} type="button">
          {mode === 'login' ? 'Войти' : 'Создать аккаунт'}
        </button>
        <button className="button button--secondary" disabled={busy} onClick={() => void handleGuest()} type="button">
          Гостевой вход
        </button>
      </div>
    </section>
  );
}
