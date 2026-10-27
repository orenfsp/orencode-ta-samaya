export const routes = {
  home: '/',
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
  /** Раздел «Соревнования» в кабинете организатора или федерации */
  cabinetCompetitions: (role: string) => `/cabinet/${role}/competitions`,
  /** Заявки спортсмена или тренера */
  cabinetMyContests: (role: string) => `/cabinet/${role}/my-contests`,
  /** Модерация заявок участников: организатор — свои соревнования, федерация — все */
  cabinetParticipants: (role: string) => `/cabinet/${role}/participants`,
  uiKit: '/design',
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  /** Ссылку с токеном строит бэк: {FRONTEND_URL}/reset-password?token=… */
  resetPassword: '/reset-password',
  cabinet: '/cabinet',
  /** Кабинет конкретной роли: у каждой роли свои разделы */
  cabinetRole: (role: string) => `/cabinet/${role}`,
  dictionaries: (key?: string) =>
    key ? `/cabinet/federation/dictionaries/${key}` : '/cabinet/federation/dictionaries',
  personalData: '/legal/personal-data',
  cookies: '/legal/cookies',
} as const
