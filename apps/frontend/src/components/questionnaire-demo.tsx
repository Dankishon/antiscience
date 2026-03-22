'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import {
  ApiClientError,
  createResponseSession,
  getActiveSurvey,
  getSurveyQuestions,
  submitResponseSession,
  updateResponseAnswers,
  type ActiveSurveyResponse,
  type SurveyQuestionResponse,
  type SurveyQuestionsResponse,
} from '../lib/api';
import {
  clearQuestionnaireDraft,
  loadQuestionnaireDraft,
  saveQuestionnaireDraft,
} from '../lib/questionnaire-storage';
import { Button } from './button';
import { Card } from './card';
import { Progress } from './progress';
import { useToast } from './toast';

const SURVEY_SLUG = process.env.NEXT_PUBLIC_SURVEY_SLUG ?? 'flower-soul-profile';
const AUTO_ADVANCE_DELAY_MS = 220;

type QuestionnaireState = {
  activeSurvey: ActiveSurveyResponse;
  questionsPayload: SurveyQuestionsResponse;
  responseId: string;
};

function buildFriendlyErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Не удалось загрузить опрос. Попробуйте ещё раз.';
}

export function QuestionnaireDemo() {
  const router = useRouter();
  const { showToast } = useToast();
  const autoAdvanceTimeoutRef = useRef<number | null>(null);
  const [isPendingNavigation, startTransition] = useTransition();
  const [questionnaireState, setQuestionnaireState] = useState<QuestionnaireState | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (autoAdvanceTimeoutRef.current) {
        window.clearTimeout(autoAdvanceTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const initializeQuestionnaire = async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        const activeSurvey = await getActiveSurvey(SURVEY_SLUG);
        const questionsPayload = await getSurveyQuestions(activeSurvey.id);
        const draft = loadQuestionnaireDraft();
        const hasMatchingDraft = draft && draft.surveyId === activeSurvey.id;
        const responseId = hasMatchingDraft ? draft.responseId : (await createResponseSession(activeSurvey.id)).id;

        setQuestionnaireState({
          activeSurvey,
          questionsPayload,
          responseId,
        });
        setAnswers(hasMatchingDraft ? draft.answers : {});
        setCurrentIndex(
          hasMatchingDraft
            ? Math.max(0, Math.min(draft.currentIndex, questionsPayload.questions.length - 1))
            : 0,
        );
      } catch (error) {
        setErrorMessage(buildFriendlyErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    };

    void initializeQuestionnaire();
  }, []);

  useEffect(() => {
    if (!questionnaireState) {
      return;
    }

    saveQuestionnaireDraft({
      responseId: questionnaireState.responseId,
      surveyId: questionnaireState.activeSurvey.id,
      surveySlug: questionnaireState.activeSurvey.slug,
      totalQuestions: questionnaireState.questionsPayload.questions.length,
      currentIndex,
      answers,
      updatedAt: new Date().toISOString(),
    });
  }, [answers, currentIndex, questionnaireState]);

  if (isLoading) {
    return (
      <div className="page">
        <Card description="Поднимаем активную версию опросника и восстанавливаем локальный черновик." title="Загрузка опроса" tone="accent">
          <Progress hint="backend + local draft" label="Подготовка questionnaire" max={100} value={45} />
        </Card>
      </div>
    );
  }

  if (errorMessage || !questionnaireState) {
    return (
      <div className="page narrowPage">
        <Card
          description={errorMessage ?? 'Не удалось инициализировать опрос.'}
          eyebrow="Questionnaire"
          title="Не получилось открыть flow"
          tone="accent"
        >
          <div className="actionRow">
            <Button href="/" variant="ghost">
              На landing
            </Button>
            <Button onClick={() => window.location.reload()}>Попробовать снова</Button>
          </div>
        </Card>
      </div>
    );
  }

  const { activeSurvey, questionsPayload, responseId } = questionnaireState;
  const totalQuestions = questionsPayload.questions.length;
  const currentQuestion = questionsPayload.questions[currentIndex];

  if (!currentQuestion) {
    return null;
  }

  const answeredCount = Object.keys(answers).length;
  const remainingCount = totalQuestions - answeredCount;
  const canGoBack = currentIndex > 0;
  const isLastQuestion = currentIndex === totalQuestions - 1;
  const currentValue = answers[currentQuestion.code];
  const likertOptions =
    questionsPayload.likertScale.length > 0
      ? questionsPayload.likertScale
      : Array.from({ length: 5 }, (_, value) => ({
          value,
          label: String(value),
        }));

  const persistAnswer = async (question: SurveyQuestionResponse, value: number, fullAnswers: Record<string, number>) => {
    setIsSaving(true);

    try {
      await updateResponseAnswers(responseId, [
        {
          questionCode: question.code,
          value,
        },
      ]);
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'response_not_found') {
        const nextSession = await createResponseSession(activeSurvey.id);
        const batch = Object.entries(fullAnswers).map(([questionCode, answerValue]) => ({
          questionCode,
          value: answerValue,
        }));

        if (batch.length > 0) {
          await updateResponseAnswers(nextSession.id, batch);
        }

        setQuestionnaireState((current) =>
          current
            ? {
                ...current,
                responseId: nextSession.id,
              }
            : current,
        );
        return nextSession.id;
      }

      throw error;
    } finally {
      setIsSaving(false);
    }

    return responseId;
  };

  const handleAnswerChange = (nextValue: number) => {
    const nextAnswers = {
      ...answers,
      [currentQuestion.code]: nextValue,
    };

    setAnswers(nextAnswers);
    setErrorMessage(null);

    if (autoAdvanceTimeoutRef.current) {
      window.clearTimeout(autoAdvanceTimeoutRef.current);
    }

    void persistAnswer(currentQuestion, nextValue, nextAnswers)
      .then(() => {
        if (!isLastQuestion) {
          autoAdvanceTimeoutRef.current = window.setTimeout(() => {
            setCurrentIndex((value) => Math.min(value + 1, totalQuestions - 1));
          }, AUTO_ADVANCE_DELAY_MS);
        }
      })
      .catch((error: unknown) => {
        showToast({
          title: 'Не удалось сохранить ответ',
          description: buildFriendlyErrorMessage(error),
        });
      });
  };

  const handleBack = () => {
    if (!canGoBack) {
      return;
    }

    if (autoAdvanceTimeoutRef.current) {
      window.clearTimeout(autoAdvanceTimeoutRef.current);
    }

    setCurrentIndex((value) => value - 1);
  };

  const handleNext = () => {
    if (isLastQuestion) {
      return;
    }

    if (autoAdvanceTimeoutRef.current) {
      window.clearTimeout(autoAdvanceTimeoutRef.current);
    }

    setCurrentIndex((value) => Math.min(value + 1, totalQuestions - 1));
  };

  const handleSubmit = async () => {
    if (autoAdvanceTimeoutRef.current) {
      window.clearTimeout(autoAdvanceTimeoutRef.current);
    }

    if (answeredCount !== totalQuestions) {
      showToast({
        title: 'Ответьте на все вопросы',
        description: `Сейчас заполнено ${String(answeredCount)} из ${String(totalQuestions)}.`,
      });
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const submitted = await submitResponseSession(responseId);
      clearQuestionnaireDraft();
      showToast({
        title: 'Опрос отправлен',
        description: `Главный цветок: ${submitted.mainFlower.flowerTitle}.`,
      });
      startTransition(() => {
        router.push(`/result?responseId=${submitted.id}`);
      });
    } catch (error) {
      setErrorMessage(buildFriendlyErrorMessage(error));
      showToast({
        title: 'Не удалось отправить опрос',
        description: buildFriendlyErrorMessage(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page">
      <section className="questionnaireTopBar">
        <div className="questionnaireTopBarCopy">
          <span className="eyebrow">Questionnaire</span>
          <h1 className="pageTitle questionnaireTitle">{activeSurvey.title}</h1>
          <p className="pageDescription">{activeSurvey.instruction ?? activeSurvey.description}</p>
        </div>
        <Button aria-label="Закрыть опрос и вернуться на landing" href="/" size="sm" variant="ghost">
          X
        </Button>
      </section>

      <div className="contentGrid">
        <Card description={activeSurvey.description} title={`Вопрос ${String(currentQuestion.number)} / ${String(totalQuestions)}`} tone="accent">
          <Progress
            hint={`Осталось ${String(remainingCount)} из ${String(totalQuestions)}`}
            label={`Прогресс ${String(currentQuestion.number)} / ${String(totalQuestions)}`}
            max={totalQuestions}
            value={answeredCount}
          />

          <div className="questionMetaRow">
            <span className="pill">{currentQuestion.scale?.title ?? 'Шкала'}</span>
            {currentQuestion.scale?.flowerTitle ? (
              <span className="pill">{currentQuestion.scale.flowerTitle}</span>
            ) : null}
          </div>

          <div className="stack">
            <p className="questionPrompt" data-testid="questionnaire-prompt">
              {currentQuestion.prompt}
            </p>

            <div className="ratingRow" role="radiogroup" aria-label={currentQuestion.prompt}>
              {likertOptions.map((option) => {
                const isSelected = currentValue === option.value;

                return (
                  <button
                    aria-checked={isSelected}
                    className={isSelected ? 'ratingButton ratingButton--selected' : 'ratingButton'}
                    data-testid={`answer-option-${String(option.value)}`}
                    key={option.value}
                    onClick={() => handleAnswerChange(option.value)}
                    role="radio"
                    type="button"
                  >
                    <strong>{option.value}</strong>
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="actionRow">
            <Button disabled={!canGoBack || isSaving || isSubmitting} onClick={handleBack} variant="ghost">
              Назад
            </Button>
            {isLastQuestion ? (
              <Button
                disabled={answeredCount !== totalQuestions || isSaving || isSubmitting || isPendingNavigation}
                onClick={handleSubmit}
              >
                {isSubmitting || isPendingNavigation ? 'Отправляем...' : 'Отправить ответы'}
              </Button>
            ) : (
              <Button disabled={typeof currentValue !== 'number' || isSaving || isSubmitting} onClick={handleNext}>
                Далее
              </Button>
            )}
          </div>
        </Card>

        <Card
          description={responseId}
          title="Состояние сессии"
        >
          <div className="stack">
            <div className="listRow">
              <strong>Ответов сохранено</strong>
              <p>
                {String(answeredCount)} / {String(totalQuestions)}
              </p>
            </div>
            <div className="listRow">
              <strong>Автопереход</strong>
              <p>После выбора ответа интерфейс мягко переводит к следующему вопросу.</p>
            </div>
            <div className="listRow">
              <strong>Локальный draft</strong>
              <p>Прогресс сохраняется в localStorage и восстанавливается после перезагрузки.</p>
            </div>
            {errorMessage ? (
              <div className="inlineError" role="alert">
                {errorMessage}
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
