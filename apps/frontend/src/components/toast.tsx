'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useRef, useState } from 'react';

type ToastInput = {
  description?: string;
  title: string;
};

type ToastRecord = ToastInput & {
  id: number;
};

type ToastContextValue = {
  showToast: (toast: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const nextIdRef = useRef(0);
  const timeoutIdsRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeoutIdsRef.current = [];
    };
  }, []);

  const showToast = ({ description, title }: ToastInput) => {
    const id = nextIdRef.current;
    nextIdRef.current += 1;

    setToasts((current) => [...current, { description, id, title }]);

    const timeoutId = window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3600);

    timeoutIdsRef.current.push(timeoutId);
  };

  const dismissToast = (id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div aria-atomic="true" aria-live="polite" className="toastViewport">
        {toasts.map((toast) => (
          <div className="toast" key={toast.id} role="status">
            <div className="toastContent">
              <strong className="toastTitle">{toast.title}</strong>
              {toast.description ? <p className="toastDescription">{toast.description}</p> : null}
            </div>
            <button
              aria-label="Скрыть уведомление"
              className="toastDismiss"
              onClick={() => dismissToast(toast.id)}
              type="button"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used inside ToastProvider.');
  }

  return context;
}
