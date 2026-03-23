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
        <Link className="brand" to="/">
          Цветочный профиль
        </Link>
        <nav className="nav">
          <NavLink to="/">Главная</NavLink>
          <NavLink to="/questionnaire">Опрос</NavLink>
          <NavLink to="/auth">{user ? user.username : 'Вход'}</NavLink>
        </nav>
        {user ? (
          <button className="button button--ghost" onClick={() => void onLogout()} type="button">
            Выйти
          </button>
        ) : null}
      </header>
      <main className="shell__main">{children}</main>
    </div>
  );
}
