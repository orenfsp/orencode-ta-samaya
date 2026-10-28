export const routes = {
  home: '/',
  notifications: '/notifications',
  cabinetNotifications: (role: string) => `/cabinet/${role}/notifications`,
  cabinetAudit: '/cabinet/federation/audit',
  /** Аналитика федерации: показатели за период, выгрузка в xlsx */
  cabinetAnalytics: '/cabinet/federation/analytics',
  news: '/news',
  newsArticle: (slug: string) => `/news/${slug}`,
  /** Новости в кабинете федерации: список, новая статья, правка */
  newsAdmin: '/cabinet/federation/news',
  newsNew: '/cabinet/federation/news/new',
  newsEdit: (id: string) => `/cabinet/federation/news/${id}/edit`,
  calendar: '/calendar',
  calendarAdmin: '/cabinet/federation/events',
  /** Модерация ролей: тренеры, судьи, организации, сотрудники ФСП */
  cabinetAccounts: '/cabinet/federation/accounts',
  competitions: '/competitions',
  competition: (id: number | string) => `/competitions/${id}`,
  /** «Соревнования» в кабинете: организатор и федерация ведут их, спортсмен и тренер записываются. Заявки — в окне карточки */
  cabinetCompetitions: (role: string) => `/cabinet/${role}/competitions`,
  /** Публичный рейтинг спортсменов: все дисциплины и группы, полный рейтинг одной группы */
  ratings: '/ratings',
  ratingTable: '/ratings/table',
  /** Действующие сборные области и одна сборная */
  squads: '/squads',
  squad: (id: number | string) => `/squads/${id}`,
  /** Положение спортсмена в рейтингах */
  cabinetRating: (role: string) => `/cabinet/${role}/rating`,
  /** Публичная страница документа: сюда ведёт QR-код */
  document: (token: string) => `/documents/${token}`,
  /** Публичная страница человека: вкладки по ролям, лента соревнований */
  person: (id: string) => `/people/${id}`,
  /** Свои документы: наградные и справки, получить справку */
  cabinetDocuments: (role: string) => `/cabinet/${role}/documents`,
  uiKit: '/design',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  /** Старые ссылки из писем: ведёт на восстановление по коду */
  resetPassword: '/reset-password',
  cabinetSettings: (role: string) => `/cabinet/${role}/settings`,
  /** Разряд спортсмена, категория судьи, заявки тренера за спортсменов */
  cabinetQualification: (role: string) =>
    `/cabinet/${role}/${role === 'judge' ? 'category' : role === 'coach' ? 'ranks' : 'rank'}`,
  cabinetJudgeAssignments: '/cabinet/judge/assignments',
  /** Очереди федерации: судейские категории и разряды */
  cabinetQualificationsReview: '/cabinet/federation/qualifications',
  cabinet: '/cabinet',
  /** Кабинет конкретной роли: у каждой роли свои разделы */
  cabinetRole: (role: string) => `/cabinet/${role}`,
  dictionaries: (key?: string) =>
    key ? `/cabinet/federation/dictionaries/${key}` : '/cabinet/federation/dictionaries',
  personalData: '/legal/personal-data',
  cookies: '/legal/cookies',
} as const
