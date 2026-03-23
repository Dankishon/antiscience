import { useEffect, useState } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { AuthPanel } from './components/AuthPanel';
import { Modal } from './components/Modal';
import { Questionnaire } from './components/Questionnaire';
import { ResultView } from './components/ResultView';
import { Shell } from './components/Shell';
import { api, type ActiveSurvey, type ResponseSession, type ResultPayload, type User } from './lib/api';
import {
  clearResultHistory,
  loadResultHistory,
  saveResultHistoryEntry,
  type StoredResult,
} from './lib/resultHistory';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatRole(user: User): string {
  return user.is_guest ? 'Гостевой доступ' : 'Личный аккаунт';
}

function AuthRequiredCard() {
  return (
    <section className="card page-card page-card--centered">
      <span className="eyebrow">Доступ по сессии</span>
      <h1>Сначала войдите в систему</h1>
      <p>После входа откроются опрос, история результатов и аналитические сводки.</p>
      <div className="stack-row">
        <Link className="button" to="/">
          Перейти к авторизации
        </Link>
      </div>
    </section>
  );
}

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
    navigate('/home');
    return response.user;
  };

  const handleLogin = async (username: string, password: string) => {
    const response = await api.login({ username, password });
    onAuthChange(response.user);
    navigate('/home');
    return response.user;
  };

  const handleGuest = async () => {
    const response = await api.guestLogin();
    onAuthChange(response.user);
    navigate('/home');
  };

  const handleLogout = async () => {
    await onLogout();
    navigate('/');
  };

  if (user) {
    return (
      <div className="page-grid page-grid--narrow">
        <section className="card card--hero page-card">
          <span className="eyebrow">Текущая сессия</span>
          <h1>{user.is_guest ? 'Вы вошли как гость' : 'Сессия активна'}</h1>
          <p>Все данные профиля доступны из одного спокойного интерфейса с историей и результатами.</p>

          <div className="metric-list">
            <div className="metric-item">
              <span>Пользователь</span>
              <strong>{user.username}</strong>
            </div>
            <div className="metric-item">
              <span>Формат доступа</span>
              <strong>{formatRole(user)}</strong>
            </div>
          </div>

          <div className="stack-row">
            <Link className="button" to="/home">
              Открыть главную
            </Link>
            <Link className="button button--secondary" to="/questionnaire">
              Начать опрос
            </Link>
            <button className="button button--ghost" onClick={() => void handleLogout()} type="button">
              Выйти
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="auth-layout">
      <section className="card card--hero auth-layout__intro">
        <span className="eyebrow">Цветочный профиль</span>
        <h1>Тихий и ясный способ пройти опрос и собрать личный психологический профиль</h1>
        <p>
          На первом экране доступны вход, регистрация и гостевой доступ. Никаких лишних полей, только спокойный
          рабочий поток.
        </p>

        <div className="metric-list">
          <div className="metric-item">
            <span>Формат входа</span>
            <strong>Имя пользователя и пароль</strong>
          </div>
          <div className="metric-item">
            <span>Гостевой сценарий</span>
            <strong>Доступ в один клик</strong>
          </div>
          <div className="metric-item">
            <span>Результат</span>
            <strong>Профиль по 10 шкалам</strong>
          </div>
        </div>
      </section>

      <AuthPanel onGuest={handleGuest} onLogin={handleLogin} onRegister={handleRegister} />
    </div>
  );
}

function HomePage({ user }: { user: User | null }) {
  const [history, setHistory] = useState<StoredResult[]>([]);

  useEffect(() => {
    setHistory(loadResultHistory());
  }, []);

  if (!user) {
    return <AuthRequiredCard />;
  }

  const latestResult = history[0];

  return (
    <div className="page-grid">
      <section className="card card--hero page-card">
        <span className="eyebrow">Главная</span>
        <h1>{user.is_guest ? 'Гостевая рабочая область' : `Здравствуйте, ${user.username}`}</h1>
        <p>
          Здесь собраны ключевые действия: новый проход опроса, история результатов и спокойный обзор вашего
          последнего профиля.
        </p>

        <div className="stack-row">
          <Link className="button" to="/questionnaire">
            Начать новый опрос
          </Link>
          <Link className="button button--secondary" to="/results">
            Открыть историю
          </Link>
        </div>
      </section>

      <section className="card card--soft dashboard-grid">
        <div className="metric-item">
          <span>Формат доступа</span>
          <strong>{formatRole(user)}</strong>
        </div>
        <div className="metric-item">
          <span>Сохранённых результатов</span>
          <strong>{history.length}</strong>
        </div>
        <div className="metric-item">
          <span>Активный опрос</span>
          <strong>30 вопросов</strong>
        </div>
      </section>

      {latestResult ? (
        <section className="card page-card">
          <span className="eyebrow">Последний результат</span>
          <div className="summary-panel">
            <div className="summary-panel__flower">
              <span className="result-symbol result-symbol--small">
                {latestResult.main_flower.flower_symbol ?? '✿'}
              </span>
              <div>
                <h2>{latestResult.main_flower.flower_title}</h2>
                <p>Сохранено {formatDate(latestResult.saved_at)}</p>
              </div>
            </div>

            <div className="summary-panel__stats">
              <div className="metric-item">
                <span>Среднее</span>
                <strong>{latestResult.mean.toFixed(2)}</strong>
              </div>
              <div className="metric-item">
                <span>SD</span>
                <strong>{latestResult.standard_deviation.toFixed(2)}</strong>
              </div>
              <div className="metric-item">
                <span>Лидирующая шкала</span>
                <strong>{latestResult.main_flower.scale_code.toUpperCase()}</strong>
              </div>
            </div>
          </div>

          <div className="stack-row">
            <Link className="button" to={`/result/${latestResult.response_session_id}`}>
              Открыть результат
            </Link>
            {!user.is_guest ? (
              <Link className="button button--ghost" to="/admin/analytics">
                Посмотреть аналитику
              </Link>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="card page-card">
          <span className="eyebrow">Результаты</span>
          <h2>После первого завершённого опроса здесь появится краткий обзор профиля</h2>
          <p>Можно начать прямо сейчас и сохранить первый результат в локальной истории.</p>
          <div className="stack-row">
            <Link className="button" to="/questionnaire">
              Перейти к вопросам
            </Link>
          </div>
        </section>
      )}
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
    return <AuthRequiredCard />;
  }

  if (loading) {
    return (
      <section className="card page-card page-card--centered">
        <span className="eyebrow">Подготовка</span>
        <h1>Собираем опросник</h1>
        <p>Через мгновение появится первый вопрос с сохранением ответов по шагам.</p>
      </section>
    );
  }

  if (error || !survey || !responseSession) {
    return (
      <section className="card page-card page-card--centered">
        <span className="eyebrow">Опрос</span>
        <h1>Сейчас опрос недоступен</h1>
        <p>{error ?? 'Не удалось получить структуру вопросов.'}</p>
        <div className="stack-row">
          <Link className="button" to="/home">
            Вернуться на главную
          </Link>
        </div>
      </section>
    );
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

function ResultsHistoryPage({ user }: { user: User | null }) {
  const [history, setHistory] = useState<StoredResult[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    setHistory(loadResultHistory());
  }, []);

  if (!user) {
    return <AuthRequiredCard />;
  }

  const handleClear = () => {
    clearResultHistory();
    setHistory([]);
    setConfirmClear(false);
  };

  return (
    <>
      <div className="page-grid">
        <section className="card card--hero page-card">
          <span className="eyebrow">История результатов</span>
          <h1>Все завершённые профили собраны в одном аккуратном списке</h1>
          <p>История хранится локально в браузере и позволяет быстро вернуться к любому недавнему результату.</p>
        </section>

        {history.length > 0 ? (
          <section className="card page-card">
            <div className="section-header">
              <div>
                <span className="eyebrow">Список результатов</span>
                <h2>{history.length} записей</h2>
              </div>
              <button className="button button--ghost" onClick={() => setConfirmClear(true)} type="button">
                Очистить историю
              </button>
            </div>

            <div className="history-list">
              {history.map((entry) => (
                <article className="history-item" key={entry.response_session_id}>
                  <div className="history-item__flower">
                    <span className="result-symbol result-symbol--small">
                      {entry.main_flower.flower_symbol ?? '✿'}
                    </span>
                    <div>
                      <h3>{entry.main_flower.flower_title}</h3>
                      <p>{formatDate(entry.saved_at)}</p>
                    </div>
                  </div>

                  <div className="history-item__stats">
                    <div className="metric-item">
                      <span>Среднее</span>
                      <strong>{entry.mean.toFixed(2)}</strong>
                    </div>
                    <div className="metric-item">
                      <span>SD</span>
                      <strong>{entry.standard_deviation.toFixed(2)}</strong>
                    </div>
                  </div>

                  <div className="history-item__actions">
                    <Link className="button button--secondary" to={`/result/${entry.response_session_id}`}>
                      Открыть
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <section className="card page-card page-card--centered">
            <span className="eyebrow">История</span>
            <h2>Пока здесь тихо</h2>
            <p>После завершения первого опроса появится чистая хронология результатов.</p>
            <div className="stack-row">
              <Link className="button" to="/questionnaire">
                Начать опрос
              </Link>
            </div>
          </section>
        )}
      </div>

      {confirmClear ? (
        <Modal
          cancelLabel="Оставить"
          confirmLabel="Очистить"
          description="История результатов будет удалена только из текущего браузера."
          onCancel={() => setConfirmClear(false)}
          onConfirm={handleClear}
          title="Очистить локальную историю?"
        />
      ) : null}
    </>
  );
}

function AdminAnalyticsPage({ user }: { user: User | null }) {
  const [history, setHistory] = useState<StoredResult[]>([]);

  useEffect(() => {
    setHistory(loadResultHistory());
  }, []);

  if (!user) {
    return <AuthRequiredCard />;
  }

  if (user.is_guest) {
    return (
      <section className="card page-card page-card--centered">
        <span className="eyebrow">Аналитика</span>
        <h1>Для гостевой сессии доступен только личный результат</h1>
        <p>После входа в постоянный аккаунт здесь будет удобнее отслеживать накопленную историю профилей.</p>
        <div className="stack-row">
          <Link className="button" to="/results">
            Открыть историю
          </Link>
        </div>
      </section>
    );
  }

  const flowerStats = history.reduce<Record<string, { count: number; symbol: string | null }>>((accumulator, entry) => {
    const key = entry.main_flower.flower_title;
    const current = accumulator[key] ?? { count: 0, symbol: entry.main_flower.flower_symbol };
    accumulator[key] = {
      count: current.count + 1,
      symbol: current.symbol,
    };
    return accumulator;
  }, {});
  const flowerDistribution = Object.entries(flowerStats)
    .map(([title, values]) => ({
      title,
      count: values.count,
      symbol: values.symbol,
    }))
    .sort((left, right) => right.count - left.count);
  const averageMean = history.length
    ? history.reduce((sum, entry) => sum + entry.mean, 0) / history.length
    : 0;
  const averageDeviation = history.length
    ? history.reduce((sum, entry) => sum + entry.standard_deviation, 0) / history.length
    : 0;
  const maxDistribution = flowerDistribution[0]?.count ?? 1;

  return (
    <div className="page-grid">
      <section className="card card--hero page-card">
        <span className="eyebrow">Аналитика</span>
        <h1>Спокойная сводка по накопленной истории результатов</h1>
        <p>Здесь собраны краткие метрики и распределение лидирующих цветков по сохранённым прохождениям.</p>
      </section>

      <section className="card card--soft dashboard-grid">
        <div className="metric-item">
          <span>Завершённых профилей</span>
          <strong>{history.length}</strong>
        </div>
        <div className="metric-item">
          <span>Среднее по M</span>
          <strong>{averageMean.toFixed(2)}</strong>
        </div>
        <div className="metric-item">
          <span>Среднее по SD</span>
          <strong>{averageDeviation.toFixed(2)}</strong>
        </div>
        <div className="metric-item">
          <span>Частый ведущий цветок</span>
          <strong>{flowerDistribution[0]?.title ?? 'Пока нет данных'}</strong>
        </div>
      </section>

      {history.length > 0 ? (
        <section className="card page-card">
          <div className="section-header">
            <div>
              <span className="eyebrow">Распределение</span>
              <h2>Лидирующие цветки</h2>
            </div>
          </div>

          <div className="distribution-list">
            {flowerDistribution.map((item) => (
              <div className="distribution-row" key={item.title}>
                <div className="distribution-row__label">
                  <strong>
                    {item.symbol} {item.title}
                  </strong>
                  <span>{item.count} профилей</span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(item.count / maxDistribution) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="card page-card page-card--centered">
          <span className="eyebrow">Аналитика</span>
          <h2>Сводка появится после первых завершённых опросов</h2>
          <p>Когда в истории накопятся результаты, здесь появятся аккуратные метрики и распределение профилей.</p>
        </section>
      )}
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
          saveResultHistoryEntry(payload);
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
    return (
      <section className="card page-card page-card--centered">
        <span className="eyebrow">Результат</span>
        <h1>Не удалось открыть профиль</h1>
        <p>{error}</p>
      </section>
    );
  }

  if (!result) {
    return (
      <section className="card page-card page-card--centered">
        <span className="eyebrow">Результат</span>
        <h1>Формируем экран результата</h1>
        <p>Загружаем интерпретацию, шкалы и сводку по цветочному профилю.</p>
      </section>
    );
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
        <section className="card page-card page-card--centered">
          <span className="eyebrow">Сессия</span>
          <h1>Проверяем доступ</h1>
          <p>Подтягиваем активную сессию и готовим интерфейс.</p>
        </section>
      ) : (
        <Routes>
          <Route element={<AuthPage onAuthChange={setUser} onLogout={handleLogout} user={user} />} path="/" />
          <Route element={<AuthPage onAuthChange={setUser} onLogout={handleLogout} user={user} />} path="/auth" />
          <Route element={<HomePage user={user} />} path="/home" />
          <Route element={<QuestionnairePage user={user} />} path="/questionnaire" />
          <Route element={<ResultsHistoryPage user={user} />} path="/results" />
          <Route element={<AdminAnalyticsPage user={user} />} path="/admin/analytics" />
          <Route element={<ResultPage />} path="/result/:responseId" />
        </Routes>
      )}
    </Shell>
  );
}
