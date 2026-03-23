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
  return (
    <div className="modal-backdrop" role="presentation">
      <div aria-modal="true" className="modal-card" role="dialog">
        <div className="modal-card__header">
          <span className="eyebrow">Подтверждение</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        {children ? <div className="modal-card__body">{children}</div> : null}
        <div className="stack-row stack-row--end">
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
