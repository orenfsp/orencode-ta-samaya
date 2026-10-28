import { createBrowserRouter, Outlet, type RouteObject } from 'react-router'
import { CabinetPage } from '@/pages/cabinet'
import { CabinetAccountsPage } from '@/pages/cabinet-accounts'
import { CabinetRatingPage } from '@/pages/cabinet-rating'
import { CabinetAthleteProfilePage } from '@/pages/cabinet-athlete-profile'
import { CabinetCoachAthletesPage } from '@/pages/cabinet-coach-athletes'
import { CabinetDeadlinesPage } from '@/pages/cabinet-deadlines'
import { CabinetDisputesPage } from '@/pages/cabinet-disputes'
import { GlossaryPage } from '@/pages/glossary'
import { VerifyQualificationPage } from '@/pages/verify-qualification'
import { CabinetDocumentsPage } from '@/pages/cabinet-documents'
import { CabinetOrganizationsPage } from '@/pages/cabinet-organizations'
import { CabinetTrainingPage, NormsPage, TrainingGroupPage } from '@/pages/cabinet-training'
import { CabinetRegistryPage } from '@/pages/cabinet-registry'
import { CabinetJudgeAssignmentsPage } from '@/pages/cabinet-judge-assignments'
import { CabinetQualificationPage } from '@/pages/cabinet-qualification'
import { CabinetQualificationsReviewPage } from '@/pages/cabinet-qualifications-review'
import { CalendarPage, EventPage } from '@/pages/calendar'
import { CalendarAdminPage } from '@/pages/calendar-admin'
import { CompetitionPage } from '@/pages/competition'
import { CompetitionsPage } from '@/pages/competitions'
import { DictionariesPage } from '@/pages/dictionaries'
import { DocumentPage } from '@/pages/document'
import { HomePage } from '@/pages/home'
import { NotificationsPage } from '@/pages/notifications'
import { AuditPage } from '@/pages/audit'
import { CabinetAnalyticsPage } from '@/pages/cabinet-analytics'
import { NewsArticlePage, NewsPage } from '@/pages/news'
import { NewsAdminPage, NewsEditorPage } from '@/pages/news-admin'
import { CookiesPage, PersonalDataPage } from '@/pages/legal'
import { LoginPage } from '@/pages/login'
import { NotFoundPage } from '@/pages/not-found'
import { RatingsPage, RatingTablePage } from '@/pages/ratings'
import { SquadsPage } from '@/pages/squads'
import { PersonPage } from '@/pages/person'
import { ForgotPasswordPage, ResetPasswordPage } from '@/pages/password-recovery'
import { RegisterPage } from '@/pages/register'
import { SettingsPage } from '@/pages/settings'
import { routes } from '@/shared/config'
import { CabinetCompetitionsRoute } from './cabinet-competitions-route'
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
        handle: showcase('Вернём доступ', 'Код для нового пароля придёт на почту и действует 15 минут'),
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
          { path: 'notifications', element: <NotificationsPage /> },
          { path: 'settings', element: <SettingsPage /> },
          {
            path: 'analytics',
            element: (
              <RequireCabinetRole role="federation">
                <CabinetAnalyticsPage />
              </RequireCabinetRole>
            ),
          },
          {
            path: 'audit',
            element: (
              <RequireCabinetRole role="federation">
                <AuditPage />
              </RequireCabinetRole>
            ),
          },
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
              <RequireCabinetRole role={['organizer', 'federation', 'athlete', 'coach']}>
                <CabinetCompetitionsRoute />
              </RequireCabinetRole>
            ),
          },
          {
            path: 'rating',
            element: (
              <RequireCabinetRole role="athlete">
                <CabinetRatingPage />
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
            path: 'documents',
            element: (
              <RequireCabinetRole role={['athlete', 'coach', 'judge']}>
                <CabinetDocumentsPage />
              </RequireCabinetRole>
            ),
          },
          { path: 'deadlines', element: <CabinetDeadlinesPage /> },
          {
            path: 'disputes',
            element: (
              <RequireCabinetRole role={['athlete', 'coach', 'federation']}>
                <CabinetDisputesPage />
              </RequireCabinetRole>
            ),
          },
          {
            path: 'profile',
            element: (
              <RequireCabinetRole role="athlete">
                <CabinetAthleteProfilePage />
              </RequireCabinetRole>
            ),
          },
          {
            path: 'athletes',
            element: (
              <RequireCabinetRole role="coach">
                <CabinetCoachAthletesPage />
              </RequireCabinetRole>
            ),
          },
          {
            path: 'registry',
            element: (
              <RequireCabinetRole role="federation">
                <CabinetRegistryPage />
              </RequireCabinetRole>
            ),
          },
          {
            path: 'organizations',
            element: (
              <RequireCabinetRole role="federation">
                <CabinetOrganizationsPage />
              </RequireCabinetRole>
            ),
          },
          {
            path: 'training',
            element: (
              <RequireCabinetRole role={['athlete', 'coach', 'federation']}>
                <CabinetTrainingPage />
              </RequireCabinetRole>
            ),
          },
          {
            path: 'training/:groupId',
            element: (
              <RequireCabinetRole role={['coach', 'federation']}>
                <TrainingGroupPage />
              </RequireCabinetRole>
            ),
          },
          {
            path: 'norms',
            element: (
              <RequireCabinetRole role="federation">
                <NormsPage />
              </RequireCabinetRole>
            ),
          },
          {
            path: 'category',
            element: (
              <RequireCabinetRole role="judge">
                <CabinetQualificationPage />
              </RequireCabinetRole>
            ),
          },
          {
            path: 'assignments',
            element: (
              <RequireCabinetRole role="judge">
                <CabinetJudgeAssignmentsPage />
              </RequireCabinetRole>
            ),
          },
          {
            path: 'rank',
            element: (
              <RequireCabinetRole role="athlete">
                <CabinetQualificationPage />
              </RequireCabinetRole>
            ),
          },
          {
            path: 'ranks',
            element: (
              <RequireCabinetRole role="coach">
                <CabinetQualificationPage />
              </RequireCabinetRole>
            ),
          },
          {
            path: 'qualifications',
            element: (
              <RequireCabinetRole role="federation">
                <CabinetQualificationsReviewPage />
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
      {
        path: routes.notifications,
        element: (
          <RequireAuth>
            <NotificationsPage />
          </RequireAuth>
        ),
      },
      { path: routes.news, element: <NewsPage /> },
      { path: `${routes.news}/:slug`, element: <NewsArticlePage /> },
      { path: routes.calendar, element: <CalendarPage /> },
      { path: `${routes.calendar}/:id`, element: <EventPage /> },
      { path: routes.competitions, element: <CompetitionsPage /> },
      { path: `${routes.competitions}/:id`, element: <CompetitionPage /> },
      { path: routes.ratings, element: <RatingsPage /> },
      { path: routes.ratingTable, element: <RatingTablePage /> },
      { path: routes.squads, element: <SquadsPage /> },
      { path: '/documents/:token', element: <DocumentPage /> },
      { path: '/verify/qualifications/:token', element: <VerifyQualificationPage /> },
      { path: routes.glossary, element: <GlossaryPage /> },
      { path: '/people/:id', element: <PersonPage /> },
      { path: routes.personalData, element: <PersonalDataPage /> },
      { path: routes.cookies, element: <CookiesPage /> },
      ...devRoutes,
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
