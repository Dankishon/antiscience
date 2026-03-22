'use client';

import { APP_NAME } from '@flower-survey/shared';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { getDictionary } from '../lib/i18n';
import { Button } from './button';
import { ThemeToggle } from './theme-toggle';

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const copy = getDictionary();

  return (
    <div className="shell">
      <header className="shellHeader">
        <div className="shellBrandRow">
          <div>
            <p className="shellBrandEyebrow">{APP_NAME}</p>
            <Link className="shellBrand" href="/">
              {copy.shell.brand}
            </Link>
          </div>
          <div className="shellActions">
            <span className="shellBadge">{copy.shell.badge}</span>
            <ThemeToggle />
            <Button href="/questionnaire" size="sm" variant="secondary">
              {copy.shell.cta}
            </Button>
          </div>
        </div>

        <nav className="shellNav" aria-label="Основная навигация">
          {copy.shell.nav.map((item) => {
            const isActive = item.href === '/' ? pathname === item.href : pathname.startsWith(item.href);

            return (
              <Link
                className={cn('shellNavLink', isActive && 'shellNavLink--active')}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="shellMain">{children}</main>

      <footer className="shellFooter">
        <p>{copy.shell.footer}</p>
      </footer>
    </div>
  );
}
