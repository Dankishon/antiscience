export const locales = ['ru'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'ru';

export const dictionaries = {
  ru: {
    meta: {
      title: 'flower-survey',
      description: 'Мобильный-first интерфейс для опросника цветочного профиля души.',
    },
    shell: {
      brand: 'Цветочный профиль',
      badge: 'RU default',
      nav: [
        { href: '/', label: 'Главная' },
        { href: '/questionnaire', label: 'Опрос' },
        { href: '/result', label: 'Результат' },
        { href: '/login', label: 'Вход' },
        { href: '/account', label: 'Кабинет' },
        { href: '/admin', label: 'Админ' },
      ],
      footer: 'UI-скелет для frontend-прототипа flower-survey.',
      cta: 'Открыть демо',
      themeLabel: {
        light: 'Светлая тема',
        dark: 'Тёмная тема',
      },
    },
    common: {
      continue: 'Далее',
      back: 'Назад',
      close: 'Закрыть',
      saveDraft: 'Сохранить черновик',
      openResult: 'Перейти к результату',
      copySummary: 'Скопировать summary',
      openDemo: 'Открыть демо',
      planned: 'Скоро',
    },
    landing: {
      eyebrow: 'Мобильный-first prototype',
      title: 'Скелет интерфейса для прохождения опросника и работы с результатом.',
      description:
        'Маршруты уже собраны под сценарий пользователя: от лендинга и регистрации до прохождения опроса, кабинета и админ-зоны.',
      primaryAction: 'Начать опрос',
      secondaryAction: 'Как устроен flow',
      statsTitle: 'Что уже готово',
      statsDescription:
        'Компоненты и страницы сверстаны так, чтобы их можно было безболезненно подключать к backend API по мере готовности.',
      stats: [
        { label: 'Маршрутов', value: '7' },
        { label: 'UI-компонентов', value: '6' },
        { label: 'Фокус', value: 'tap targets 52px+' },
      ],
      progressLabel: 'Готовность UI-сценария',
      progressHint: 'Навигация, формы, демо-опрос и stub админки',
      features: [
        {
          title: 'Прохождение опроса',
          description: 'Progress, radio-группы и модальные подсказки уже собраны в единый flow.',
        },
        {
          title: 'Результат и кабинет',
          description: 'Есть шаблоны карточек результата, истории сессий и уведомлений для действий пользователя.',
        },
        {
          title: 'Админский контур',
          description: 'Подготовлена страница-заглушка для publish, assets и analytics export.',
        },
      ],
      flowTitle: 'Как выглядит путь пользователя',
      flowSteps: [
        'Лендинг объясняет пользу опроса и ведёт в демо-сценарий.',
        'Страница questionnaire показывает структуру одного шага и поведение крупных tap targets.',
        'Result и account демонстрируют, как отдавать метрики, карточки и уведомления.',
      ],
      routeCards: [
        {
          href: '/questionnaire',
          title: 'Questionnaire',
          description: 'Три тестовых вопроса, прогресс и черновик.',
        },
        {
          href: '/result',
          title: 'Result',
          description: 'Главный цветок, среднее, SD и шкалы.',
        },
        {
          href: '/register',
          title: 'Register',
          description: 'Форма регистрации и подготовка к auth flow.',
        },
      ],
      modal: {
        title: 'Flow интерфейса',
        description: 'Этот макет показывает, как страницы будут связаны после подключения backend API.',
        closeAction: 'Понятно',
      },
    },
    questionnaire: {
      eyebrow: 'Questionnaire demo',
      title: 'Опрос в формате короткого прототипа.',
      description:
        'Сейчас это демо на 3 вопроса, но структура готова для подключения 30 вопросов и пошаговой навигации.',
      helpAction: 'Как отвечать',
      finishTitle: 'Результат готов',
      finishDescription:
        'Демо завершено. Следующий шаг после подключения API — отправка сессии и переход к реальному результату.',
      progressLabel: 'Пройдено вопросов',
      summaryTitle: 'Панель шага',
      summaryDescription: 'Текущее состояние прогресса и карта ответов для мобильного потока.',
      answered: 'Отвечено',
      questionBadge: 'Вопрос',
      modal: {
        title: 'Подсказка по ответам',
        description: 'Используйте шкалу от 0 до 4 и выбирайте вариант, который ближе всего к вашему состоянию.',
        closeAction: 'Понятно',
      },
      savedToast: {
        title: 'Черновик обновлён',
        description: 'Ответ сохранён локально в демонстрационном состоянии интерфейса.',
      },
      finishedToast: {
        title: 'Демо-результат подготовлен',
        description: 'Можно перейти к экрану результата и проверить раскладку карточек.',
      },
      options: [
        { value: '0', label: 'Совсем не похоже', description: 'Редко или почти никогда.' },
        { value: '1', label: 'Скорее не похоже', description: 'Иногда встречается, но не является фоном.' },
        { value: '2', label: 'Нейтрально', description: 'Не могу уверенно отнести к себе.' },
        { value: '3', label: 'Скорее похоже', description: 'Часто узнаю себя в описании.' },
        { value: '4', label: 'Очень похоже', description: 'Это устойчивое состояние или привычный паттерн.' },
      ],
      questions: [
        {
          code: 'hs_01',
          scale: 'Ипохондрия',
          title: 'Я часто отслеживаю внутренние сигналы тела и быстро замечаю малейшие изменения.',
        },
        {
          code: 'd_01',
          scale: 'Депрессия',
          title: 'Бывает трудно включиться в дела, даже если они раньше приносили интерес.',
        },
        {
          code: 'hy_01',
          scale: 'Истерия',
          title: 'Мне важно, чтобы окружающие замечали мои чувства и откликались на них.',
        },
      ],
    },
    result: {
      eyebrow: 'Result experience',
      title: 'Результат опроса и полный цветочный профиль.',
      description:
        'Экран собирается из реального backend-ответа: главный цветок, статистика, график шкал и интерпретации.',
      flowerTitle: 'Лилия',
      flowerSubtitle: 'Спокойная собранность, мягкий фокус на смысле и чувствительности к сигналам среды.',
      meanLabel: 'Среднее M',
      sdLabel: 'Стандартное отклонение SD',
      tieLabel: 'Tie-break',
      scoreLabel: 'Сырой балл X',
      submittedLabel: 'Отправлено',
      chartTitle: 'Профиль по шкалам',
      chartDescription: 'Сравните Z-показатели и сырые X по всем 10 шкалам.',
      chartModes: {
        z: 'Показать Z',
        raw: 'Показать raw X',
      },
      chartSeries: {
        z: 'Z-оценка',
        raw: 'Сырой балл X',
      },
      tableTitle: 'Полный профиль',
      tableDescription: 'Все 10 шкал с рангом, сырым баллом и Z-показателем.',
      tableColumns: {
        rank: 'Ранг',
        scale: 'Шкала',
        flower: 'Цветок',
        raw: 'X',
        z: 'Z',
        level: 'Уровень',
      },
      interpretationTitle: 'Интерпретации',
      interpretationDescription:
        'Главный цветок дополняется диапазоном Z, базовым профилем и ключевыми чертами из каталога интерпретаций.',
      traitsTitle: 'Ключевые черты',
      highlightsTitle: 'Выразительные акценты профиля',
      fallbackInterpretation:
        'Интерпретация для этого цветка пока не найдена в локальном каталоге. Можно опираться на статистику шкал и основной профиль результата.',
      emptyStateTitle: 'Нужен responseId результата',
      emptyStateDescription:
        'Откройте страницу после submit опроса или передайте `responseId` в query string, чтобы загрузить реальный профиль.',
      levelFallback: 'Без интерпретации',
      copyToast: {
        title: 'Summary скопирован',
        description: 'Когда подключим API, сюда можно будет добавить экспорт или share sheet.',
      },
      scales: [
        { code: 'hs', title: 'Ипохондрия', rawX: 9, z: 1.36 },
        { code: 'd', title: 'Депрессия', rawX: 4, z: 0.14 },
        { code: 'hy', title: 'Истерия', rawX: 3, z: -0.12 },
        { code: 'pd', title: 'Психопатия', rawX: 2, z: -0.55 },
      ],
    },
    auth: {
      login: {
        eyebrow: 'Secure entry',
        title: 'Вход в личный кабинет',
        description: 'Форма готова под cookie-based auth и дальнейшее подключение к backend.',
        submit: 'Войти',
        alternateHref: '/register',
        alternateLabel: 'Создать аккаунт',
        toastTitle: 'Демо-вход выполнен',
        toastDescription: 'Форма пока работает как UI-скелет без запроса к API.',
      },
      register: {
        eyebrow: 'Create account',
        title: 'Регистрация нового пользователя',
        description: 'Подготовка к email/password auth с валидацией и удобными крупными полями.',
        submit: 'Зарегистрироваться',
        alternateHref: '/login',
        alternateLabel: 'У меня уже есть аккаунт',
        toastTitle: 'Профиль создан в демо-режиме',
        toastDescription: 'Следующим шагом можно подключить POST /api/auth/register.',
      },
      fields: {
        displayName: 'Имя',
        email: 'Email',
        password: 'Пароль',
        helper: 'Минимум 8 символов. В демо запрос на сервер пока не выполняется.',
      },
    },
    account: {
      eyebrow: 'Account overview',
      title: 'Кабинет пользователя и история активности.',
      description:
        'Из кабинета можно скачать свои данные, завершить сессию и запросить удаление аккаунта с очисткой связанных данных.',
      downloadAction: 'Скачать мои данные',
      logoutAction: 'Выйти',
      deleteAction: 'Удалить мои данные',
      privacyTitle: 'GDPR и приватность',
      dataCardTitle: 'Self-service',
      loading: 'Проверяем активную сессию и подгружаем данные профиля.',
      downloadToast: {
        title: 'Экспорт готов',
        description: 'JSON-файл с вашим профилем и связанными данными начал скачиваться.',
      },
      logoutToast: {
        title: 'Сессия завершена',
        description: 'HttpOnly cookies очищены, повторный вход потребуется для новых персональных действий.',
      },
      deleteToast: {
        title: 'Запрос на удаление выполнен',
        description: 'Удалены привязанные сессии: {count}. Аудит сохранён в обезличенном виде.',
      },
      modal: {
        title: 'Подтвердить выход',
        description: 'Текущая access/refresh сессия будет завершена на этом устройстве.',
        confirm: 'Подтвердить выход',
        helper: 'После logout export и delete снова станут недоступны, пока вы не войдёте заново.',
      },
      deleteModal: {
        title: 'Подтвердить удаление данных',
        description: 'Это действие удалит ваш аккаунт, refresh-токены и все привязанные персональные response sessions.',
        helper: 'Для подтверждения введите DELETE. В audit log останется только обезличенная запись о факте удаления.',
        label: 'Введите DELETE',
        cancel: 'Отмена',
        confirm: 'Удалить навсегда',
      },
      profile: {
        name: 'Ваш профиль',
      },
      unauthorized: {
        title: 'Нужна авторизация',
        description: 'Войдите через backend auth, чтобы скачать JSON-экспорт или удалить свой аккаунт.',
        email: 'Сессия не найдена',
        badge: 'Гость',
        primaryAction: 'Перейти ко входу',
        secondaryAction: 'Создать аккаунт',
      },
      stats: {
        sessions: 'Экспорт охватывает',
        identifiedOnly: 'только идентифицированные response sessions',
        exportIncludes: 'Внутри файла',
        exportItems: ['профиль', 'refresh token metadata', 'ответы', 'результаты', 'audit entries'],
      },
      errors: {
        load: 'Не удалось получить текущую сессию.',
        download: 'Не удалось скачать JSON-экспорт.',
        logout: 'Не удалось завершить сессию.',
        delete: 'Не удалось удалить данные аккаунта.',
      },
    },
    admin: {
      eyebrow: 'Admin placeholder',
      title: 'Заглушка админского интерфейса.',
      description:
        'API уже может жить отдельно, а эта страница фиксирует будущую UI-структуру для управления версиями и аналитикой.',
      readinessLabel: 'Готовность интерфейса админки',
      readinessHint: 'Каркас есть, дальше можно подключать реальные таблицы, фильтры и upload flow.',
      cards: [
        {
          title: 'Publish survey version',
          description: 'Отдельный блок для публикации версии опросника и статуса активной ревизии.',
        },
        {
          title: 'Assets для flowers',
          description: 'Зона для загрузки изображений и привязки материалов к цветкам.',
        },
        {
          title: 'Analytics export',
          description: 'Фильтры периода, формат CSV/JSON и запуск больших экспортов.',
        },
        {
          title: 'Retention cleanup',
          description: 'Настройка срока хранения и удаление старых анонимных сессий по GDPR-политике.',
        },
      ],
      retention: {
        title: 'Retention анонимных сессий',
        description:
          'Политика хранит только окно в днях. При cleanup удаляются только старые anonymous response sessions, идентифицированные записи не затрагиваются.',
        label: 'Сколько дней хранить anonymous sessions',
        loading: 'Загружаем текущую retention-политику.',
        forbidden: 'Для управления retention нужен вход под ADMIN или OWNER.',
        lastDeletedLabel: 'Удалено в последнем cleanup: {count}',
        lastCleanupLabel: 'Последний cleanup: {value}',
        never: 'ещё не запускался',
        saveAction: 'Сохранить policy',
        cleanupAction: 'Сохранить и очистить',
        toastSave: {
          title: 'Retention policy обновлена',
          description: 'Новое окно хранения: {days} дней.',
        },
        toastCleanup: {
          title: 'Cleanup завершён',
          description: 'Удалено анонимных сессий: {count}.',
        },
        errors: {
          load: 'Не удалось загрузить retention-политику.',
          save: 'Не удалось обновить retention-политику.',
          validation: 'Retention должен быть целым числом не меньше 1.',
        },
      },
    },
  },
} as const;

export function getDictionary(locale: Locale = defaultLocale) {
  return dictionaries[locale];
}
