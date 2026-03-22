import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

type CardTone = 'default' | 'accent' | 'muted';

type CardProps = {
  children?: ReactNode;
  className?: string;
  description?: string;
  eyebrow?: string;
  footer?: ReactNode;
  title?: string;
  tone?: CardTone;
};

export function Card({
  children,
  className,
  description,
  eyebrow,
  footer,
  title,
  tone = 'default',
}: CardProps) {
  return (
    <section className={cn('card', `card--${tone}`, className)}>
      {(eyebrow || title || description) && (
        <header className="cardHeader">
          {eyebrow ? <p className="cardEyebrow">{eyebrow}</p> : null}
          {title ? <h2 className="cardTitle">{title}</h2> : null}
          {description ? <p className="cardDescription">{description}</p> : null}
        </header>
      )}

      {children ? <div className="cardBody">{children}</div> : null}
      {footer ? <footer className="cardFooter">{footer}</footer> : null}
    </section>
  );
}
