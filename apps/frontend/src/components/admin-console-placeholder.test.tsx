import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminConsolePlaceholder } from './admin-console-placeholder';
import { ToastProvider } from './toast';

describe('AdminConsolePlaceholder', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('loads retention policy and sends cleanup update', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            retentionDays: 30,
            lastCleanupAt: null,
            lastDeletedCount: 0,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            retentionDays: 14,
            cleanup: {
              executed: true,
              cutoffAt: '2026-03-08T12:00:00.000Z',
              deletedSessionsCount: 3,
              lastCleanupAt: '2026-03-22T12:00:00.000Z',
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

    render(
      <ToastProvider>
        <AdminConsolePlaceholder />
      </ToastProvider>,
    );

    const input = await screen.findByLabelText(/сколько дней хранить anonymous sessions/i);
    fireEvent.change(input, { target: { value: '14' } });
    fireEvent.click(screen.getByRole('button', { name: /сохранить и очистить/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/retention/anonymous-sessions', expect.any(Object));
    });

    expect(screen.getByText(/удалено анонимных сессий: 3/i)).toBeInTheDocument();
    expect(screen.getByText(/удалено в последнем cleanup: 3/i)).toBeInTheDocument();
  });
});
