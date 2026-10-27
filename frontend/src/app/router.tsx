import { createBrowserRouter, Outlet, type RouteObject } from 'react-router'
import { CabinetPage } from '@/pages/cabinet'
import { CabinetAccountsPage } from '@/pages/cabinet-accounts'
import { CabinetCompetitionsPage } from '@/pages/cabinet-competitions'
import { CabinetMyContestsPage } from '@/pages/cabinet-my-contests'
import { CabinetParticipantsPage } from '@/pages/cabinet-participants'
import { CalendarPage, EventPage } from '@/pages/calendar'
import { CalendarAdminPage } from '@/pages/calendar-admin'
import { CompetitionPage } from '@/pages/competition'
import { CompetitionsPage } from '@/pages/competitions'
import { DictionariesPage } from '@/pages/dictionaries'
import { HomePage } from '@/pages/home'
import { NewsArticlePage, NewsPage } from '@/pages/news'
import { NewsAdminPage, NewsEditorPage } from '@/pages/news-admin'
import { CookiesPage, PersonalDataPage } from '@/pages/legal'
import { LoginPage } from '@/pages/login'
import { NotFoundPage } from '@/pages/not-found'
import { ForgotPasswordPage, ResetPasswordPage } from '@/pages/password-recovery'
import { RegisterPage } from '@/pages/register'
import { routes } from '@/shared/config'
import { GuestOnly, RequireAuth, RequireCabinetRole } from './guards'
import { AuthLayout, type AuthRouteHandle } from './layouts/auth-layout'
import { CabinetIndexRedirect, CabinetLayout } from './layouts/cabinet-layout'
import { PublicLayout } from './layouts/public-layout'
import { RouteError } from './layouts/route-error'

// Витрина компонентов — только в dev: import.meta.env.DEV заменяется на false при сборке, и чанк не попадает в прод
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: routes.uiKit,
        lazy: () => import('@/pages/ui-kit').then((module) => ({ Component: module.UiKitPage })),
      },
    ]
  : []

const showcase = (title: string, caption: string): AuthRouteHandle => ({ showcase: { title, caption } })

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    errorElement: <RouteError />,
    children: [
      {
        path: routes.login,
        element: (
          <GuestOnly>
            <LoginPage />
          </GuestOnly>
        ),
        handle: showcase(
          'Спортивное программирование Оренбуржья',
          'Соревнования, разряды, рейтинг и сборная региона',
        ),
      },
      {
        path: routes.register,
        element: (
          <GuestOnly>
            <RegisterPage />
          </GuestOnly>
        ),
        handle: showcase(
          'Один аккаунт на все роли',
          'Спортсмен, тренер, судья или организация: переключайтесь между кабинетами без повторного входа',
        ),
      },
      {
        path: routes.forgotPassword,
        element: <ForgotPasswordPage />,
        handle: showcase('Вернём доступ', 'Ссылка для нового пароля придёт на почту и действует один час'),
      },
      {
        path: routes.resetPassword,
        element: <ResetPasswordPage />,
        handle: showcase('Новый пароль', 'После сохранения войдите заново на всех устройствах'),
      },
    ],
  },
  {
    path: routes.cabinet,
    errorElement: <RouteError />,
    element: (
      <RequireAuth>
        <Outlet />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <CabinetIndexRedirect /> },
      {
        path: ':role',
        element: <CabinetLayout />,
        children: [
          { index: true, element: <CabinetPage /> },
          {
            path: 'news',
            element: (
              <RequireCabinetRole role="federation">
                <NewsAdminPage />
              </RequireCabinetRole>
            ),
          },
          {
            path: 'news/new',
            element: (
              <RequireCabinetRole role="federation">
                <NewsEditorPage />
              </RequireCabinetRole>
            ),
          },
          {
            path: 'news/:id/edit',
            element: (
              <RequireCabinetRole role="federation">
                <NewsEditorPage />
              </RequireCabinetRole>
            ),
          },
          {
            path: 'competitions',
            element: (
              <RequireCabinetRole role={['organizer', 'federation']}>
                <CabinetCompetitionsPage />
              </RequireCabinetRole>
            ),
          },
          {
            path: 'participants',
            element: (
              <RequireCabinetRole role={['organizer', 'federation']}>
                <CabinetParticipantsPage />
              </RequireCabinetRole>
            ),
          },
          {
            path: 'my-contests',
            element: (
              <RequireCabinetRole role={['athlete', 'coach']}>
                <CabinetMyContestsPage />
              </RequireCabinetRole>
            ),
          },
          {
            path: 'accounts',
            element: (
              <RequireCabinetRole role="federation">
                <CabinetAccountsPage />
              </RequireCabinetRole>
            ),
          },
          {
            path: 'events',
            element: (
              <RequireCabinetRole role="federation">
                <CalendarAdminPage />
              </RequireCabinetRole>
            ),
          },
          {
            path: 'dictionaries/:key?',
            element: (
              <RequireCabinetRole role="federation">
                <DictionariesPage />
              </RequireCabinetRole>
            ),
          },
        ],
      },
    ],
  },
  {
    element: <PublicLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomePage /> },
      { path: routes.news, element: <NewsPage /> },
      { path: `${routes.news}/:slug`, element: <NewsArticlePage /> },
      { path: routes.calendar, element: <CalendarPage /> },
      { path: `${routes.calendar}/:id`, element: <EventPage /> },
      { path: routes.competitions, element: <CompetitionsPage /> },
      { path: `${routes.competitions}/:id`, element: <CompetitionPage /> },
      { path: routes.personalData, element: <PersonalDataPage /> },
      { path: routes.cookies, element: <CookiesPage /> },
      ...devRoutes,
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
