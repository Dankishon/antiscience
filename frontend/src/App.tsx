import { useEffect, useState } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { AuthPanel } from './components/AuthPanel';
import { Questionnaire } from './components/Questionnaire';
import { ResultView } from './components/ResultView';
import { Shell } from './components/Shell';
import { api, type ActiveSurvey, type ResponseSession, type ResultPayload, type User } from './lib/api';

function AuthPage({
  user,
  onAuthChange,
  onLogout,
}: {
  user: User | null;
  onAuthChange: (user: User | null) => void;
  onLogout: () => Promise<void>;
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

  const handleLogout = async () => {
    await onLogout();
    navigate('/');
  };

  if (user) {
    const roleLabel = user.role === 'guest' ? 'гость' : 'пользователь';

    return (
      <div className="page-grid page-grid--narrow">
        <section className="card card--hero">
          <span className="eyebrow">Текущая сессия</span>
          <h1>{user.is_guest ? 'Гостевой вход активен' : 'Вы вошли в систему'}</h1>
          <p>
            Пользователь: <strong>{user.username}</strong>
          </p>
          <p>
            Роль: <strong>{roleLabel}</strong>
          </p>
          <div className="stack-row">
            <Link className="button" to="/questionnaire">
              Перейти к опросу
            </Link>
            <button className="button button--secondary" onClick={() => void handleLogout()} type="button">
              Выйти
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-grid page-grid--narrow">
      <section className="card card--hero">
        <span className="eyebrow">Авторизация</span>
        <h1>Войдите в систему или создайте новый аккаунт</h1>
        <p>На первом экране доступны вход по имени пользователя, регистрация и гостевой вход.</p>
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
        <p>Чтобы начать опрос, войдите по имени пользователя и паролю или создайте гостевую сессию.</p>
        <Link className="button" to="/">
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
          <Route element={<AuthPage onAuthChange={setUser} onLogout={handleLogout} user={user} />} path="/" />
          <Route element={<AuthPage onAuthChange={setUser} onLogout={handleLogout} user={user} />} path="/auth" />
          <Route element={<QuestionnairePage user={user} />} path="/questionnaire" />
          <Route element={<ResultPage />} path="/result/:responseId" />
        </Routes>
      )}
    </Shell>
  );
}
