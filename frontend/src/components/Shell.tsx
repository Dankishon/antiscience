import { Link, NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { User } from '../lib/api';

interface ShellProps {
  children: ReactNode;
  user: User | null;
  onLogout: () => Promise<void>;
}

export function Shell({ children, user, onLogout }: ShellProps) {
  return (
    <div className="shell">
      <header className="shell__header">
        <div className="shell__brand-group">
          <Link className="brand" to={user ? '/home' : '/'}>
            Цветочный профиль
          </Link>
          <p className="shell__subtitle">Спокойный интерфейс для личного психологического профиля</p>
        </div>

        <div className="shell__nav-group">
          <nav className="nav">
            {user ? (
              <>
                <NavLink to="/home">Главная</NavLink>
                <NavLink to="/questionnaire">Опрос</NavLink>
                <NavLink to="/results">История</NavLink>
                {user.role === 'admin' ? <NavLink to="/admin/analytics">Аналитика</NavLink> : null}
              </>
            ) : (
              <NavLink to="/">Вход</NavLink>
            )}
          </nav>

          {user ? (
            <div className="shell__session">
              <div className="shell__session-copy">
                <strong>{user.username}</strong>
                <span>{user.is_guest ? 'Гостевой доступ' : 'Личный аккаунт'}</span>
              </div>
              <button className="button button--ghost" onClick={() => void onLogout()} type="button">
                Выйти
              </button>
            </div>
          ) : null}
        </div>
      </header>
      <main className="shell__main">{children}</main>
    </div>
  );
}
