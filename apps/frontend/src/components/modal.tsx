'use client';

import type { ReactNode } from 'react';
import { useEffect, useId } from 'react';
import { Button } from './button';

type ModalProps = {
  children: ReactNode;
  description?: string;
  footer?: ReactNode;
  onClose: () => void;
  open: boolean;
  title: string;
};

export function Modal({ children, description, footer, onClose, open, title }: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="modalBackdrop" onClick={onClose}>
      <div
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className="modalPanel"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="modalHeader">
          <div>
            <h2 className="modalTitle" id={titleId}>
              {title}
            </h2>
            {description ? (
              <p className="modalDescription" id={descriptionId}>
                {description}
              </p>
            ) : null}
          </div>
          <Button aria-label="Закрыть модальное окно" onClick={onClose} size="sm" variant="ghost">
            Закрыть
          </Button>
        </div>

        <div className="modalBody">{children}</div>
        {footer ? <div className="modalFooter">{footer}</div> : null}
      </div>
    </div>
  );
}
