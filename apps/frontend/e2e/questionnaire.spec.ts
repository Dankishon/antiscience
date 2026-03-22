import { expect, test } from '@playwright/test';

test('completes the 30-question survey flow and lands on the result screen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /начать опрос/i }).click();

  await expect(page.getByText(/вопрос 1 \/ 30/i)).toBeVisible();
  await expect(page.getByTestId('questionnaire-prompt')).toBeVisible();

  await page.getByTestId('answer-option-4').click();
  await expect(page.getByText(/вопрос 2 \/ 30/i)).toBeVisible();

  await page.reload();
  await expect(page.getByText(/вопрос 2 \/ 30/i)).toBeVisible();

  for (let index = 1; index < 30; index += 1) {
    const answerValue = index < 3 ? 4 : 0;
    await page.getByTestId(`answer-option-${String(answerValue)}`).click();

    if (index < 29) {
      await expect(page.getByText(new RegExp(`вопрос ${String(index + 2)} \\/ 30`, 'i'))).toBeVisible();
    }
  }

  await expect(page.getByRole('button', { name: /отправить ответы/i })).toBeEnabled();
  await page.getByRole('button', { name: /отправить ответы/i }).click();

  await page.waitForURL(/\/result\?responseId=/);
  await expect(page.getByRole('heading', { name: /лилия/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /полный профиль/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /интерпретации/i })).toBeVisible();
  await expect(page.getByRole('table').getByText(/ипохондрия/i)).toBeVisible();
});
