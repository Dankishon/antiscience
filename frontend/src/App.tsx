import { useEffect, useState } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { AuthPanel } from './components/AuthPanel';
import { Questionnaire } from './components/Questionnaire';
import { ResultView } from './components/ResultView';
import { Shell } from './components/Shell';
import { api, type ActiveSurvey, type ResponseSession, type ResultPayload, type User } from './lib/api';

function HomePage({ user }: { user: User | null }) {
  return (
    <div className="page-grid">
      <section className="card card--hero">
        <span className="eyebrow">Психологический опросник</span>
        <h1>Соберите цветочный профиль по 30 вопросам и получите подробный внутренний рисунок.</h1>
        <p>
          Приложение работает на React + Vite, FastAPI, PostgreSQL и проходит через единый Nginx reverse proxy.
        </p>
        <div className="stack-row">
          <Link className="button" to={user ? '/questionnaire' : '/auth'}>
            {user ? 'Перейти к опросу' : 'Войти в систему'}
          </Link>
          <Link className="button button--secondary" to="/questionnaire">
            Открыть опрос
          </Link>
        </div>
      </section>
      <section className="card">
        <span className="eyebrow">Что внутри</span>
        <ul className="list">
          <li>Вход по username и password без внешних идентификационных провайдеров.</li>
          <li>Гостевой вход для быстрого старта без отдельной регистрации.</li>
          <li>Расчёт результата по 10 шкалам и 30 вопросам на сервере.</li>
        </ul>
      </section>
    </div>
  );
}

function AuthPage({
  onAuthChange,
}: {
  onAuthChange: (user: User | null) => void;
}) {
  const navigate = useNavigate();

  const handleRegister = async (username: string, password: string) => {
    const response = await api.register({ username, password });
    onAuthChange(response.user);
    navigate('/questionnaire');
    return response.user;
  };

  const handleLogin = async (username: string, password: string) => {
    const response = await api.login({ username, password });
    onAuthChange(response.user);
    navigate('/questionnaire');
    return response.user;
  };

  const handleGuest = async () => {
    const response = await api.guestLogin();
    onAuthChange(response.user);
    navigate('/questionnaire');
  };

  return (
    <div className="page-grid page-grid--narrow">
      <section className="card">
        <span className="eyebrow">Авторизация</span>
        <h1>Вход в систему</h1>
        <p>Используйте username и пароль или создайте гостевую сессию.</p>
      </section>
      <AuthPanel onGuest={handleGuest} onLogin={handleLogin} onRegister={handleRegister} />
    </div>
  );
}

function QuestionnairePage({ user }: { user: User | null }) {
  const navigate = useNavigate();
  const [survey, setSurvey] = useState<ActiveSurvey | null>(null);
  const [responseSession, setResponseSession] = useState<ResponseSession | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }

    let active = true;
    const load = async () => {
      try {
        const activeSurvey = await api.getActiveSurvey();
        if (!active) {
          return;
        }
        setSurvey(activeSurvey);
        const session = await api.createResponse();
        if (!active) {
          return;
        }
        setResponseSession(session);
      } catch (currentError) {
        if (active) {
          setError(currentError instanceof Error ? currentError.message : 'Не удалось загрузить опрос');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [user]);

  if (!user) {
    return (
      <section className="card">
        <h1>Нужна авторизация</h1>
        <p>Чтобы начать опрос, войдите по username и password или создайте гостевую сессию.</p>
        <Link className="button" to="/auth">
          Перейти ко входу
        </Link>
      </section>
    );
  }

  if (loading) {
    return <section className="card"><p>Загружаем опрос...</p></section>;
  }

  if (error || !survey || !responseSession) {
    return <section className="card"><p>{error ?? 'Опрос сейчас недоступен.'}</p></section>;
  }

  const handleSelect = async (questionCode: string, value: number) => {
    setSaving(true);
    setError(null);
    try {
      const updatedSession = await api.saveAnswer(responseSession.id, {
        question_code: questionCode,
        value,
      });
      setAnswers((current) => ({ ...current, [questionCode]: value }));
      setResponseSession(updatedSession);
      setCurrentIndex((current) => Math.min(current + 1, survey.questions.length - 1));
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Не удалось сохранить ответ');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (currentIndex < survey.questions.length - 1) {
      setCurrentIndex((current) => current + 1);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await api.submitResponse(responseSession.id);
      navigate(`/result/${result.response_session_id}`);
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Не удалось завершить опрос');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-grid">
      {error ? <div className="notice notice--error">{error}</div> : null}
      <Questionnaire
        answers={answers}
        currentIndex={currentIndex}
        onBack={() => setCurrentIndex((current) => Math.max(current - 1, 0))}
        onSelect={handleSelect}
        onSubmit={handleSubmit}
        responseSession={responseSession}
        saving={saving}
        submitting={submitting}
        survey={survey}
      />
    </div>
  );
}

function ResultPage() {
  const { responseId } = useParams();
  const [result, setResult] = useState<ResultPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!responseId) {
      return;
    }

    let active = true;
    const loadResult = async () => {
      try {
        const payload = await api.getResult(responseId);
        if (active) {
          setResult(payload);
        }
      } catch (currentError) {
        if (active) {
          setError(currentError instanceof Error ? currentError.message : 'Не удалось загрузить результат');
        }
      }
    };

    void loadResult();
    return () => {
      active = false;
    };
  }, [responseId]);

  if (error) {
    return <section className="card"><p>{error}</p></section>;
  }

  if (!result) {
    return <section className="card"><p>Загружаем результат...</p></section>;
  }

  return <ResultView result={result} />;
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    let active = true;
    const loadCurrentUser = async () => {
      try {
        const response = await api.getCurrentUser();
        if (active) {
          setUser(response.user);
        }
      } catch {
        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setLoadingUser(false);
        }
      }
    };

    void loadCurrentUser();
    return () => {
      active = false;
    };
  }, []);

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
  };

  return (
    <Shell onLogout={handleLogout} user={user}>
      {loadingUser ? (
        <section className="card"><p>Проверяем сессию...</p></section>
      ) : (
        <Routes>
          <Route element={<HomePage user={user} />} path="/" />
          <Route element={<AuthPage onAuthChange={setUser} />} path="/auth" />
          <Route element={<QuestionnairePage user={user} />} path="/questionnaire" />
          <Route element={<ResultPage />} path="/result/:responseId" />
        </Routes>
      )}
    </Shell>
  );
}
