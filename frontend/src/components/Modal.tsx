import { useEffect } from 'react';
import type { ReactNode } from 'react';

interface ModalProps {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

export function Modal({
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  children,
}: ModalProps) {
  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeydown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [onCancel]);

  return (
    <div className="modal-backdrop" onClick={onCancel} role="presentation">
      <div
        aria-modal="true"
        className="modal-card"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="modal-card__header">
          <div className="modal-card__topbar">
            <span className="eyebrow">Подтверждение</span>
            <button
              aria-label="Закрыть окно"
              className="modal-card__dismiss"
              onClick={onCancel}
              type="button"
            >
              ×
            </button>
          </div>
          <div className="modal-card__headline">
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
        </div>
        {children ? <div className="modal-card__body">{children}</div> : null}
        <div className="modal-card__footer stack-row stack-row--end">
          <button className="button button--secondary" onClick={onCancel} type="button">
            {cancelLabel}
          </button>
          <button className="button" onClick={onConfirm} type="button">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
