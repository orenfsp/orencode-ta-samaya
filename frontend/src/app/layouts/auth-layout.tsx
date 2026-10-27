import { Link, Outlet, ScrollRestoration, useLocation, useMatches } from 'react-router'
import { routes } from '@/shared/config'
import { AuthShowcase, type AuthShowcaseProps } from '@/widgets/auth-showcase'
import { CookieBanner } from '@/widgets/cookie-banner'
import { BrandLogo, ThemeToggle } from '@/shared/ui'

export interface AuthRouteHandle {
  showcase: AuthShowcaseProps
}

/**
 * Две секции: слева форма, справа слоган и фирменный знак. Слоган задаёт маршрут через handle,
 * лейаут один на все страницы входа. На телефоне правой секции нет: форма занимает весь экран.
 */
export function AuthLayout() {
  const { pathname } = useLocation()
  const showcase = (useMatches().at(-1)?.handle as AuthRouteHandle | undefined)?.showcase

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex min-h-dvh flex-col px-5 py-6 sm:px-10 sm:py-8">
        <div className="flex items-center justify-between gap-4">
          <Link to={routes.home} aria-label="На главную" className="self-start rounded-sm">
            <BrandLogo className="h-8 w-auto" />
          </Link>
          <ThemeToggle />
        </div>

        <main id="main" className="flex flex-1 items-center justify-center py-10">
          <div key={pathname} className="w-full max-w-[26rem] animate-rise">
            <Outlet />
          </div>
        </main>

        <nav aria-label="Документы" className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
          <Link to={routes.personalData} className="transition-colors duration-150 hover:text-ink">
            Обработка персональных данных
          </Link>
          <Link to={routes.cookies} className="transition-colors duration-150 hover:text-ink">
            Использование cookie
          </Link>
        </nav>
      </div>

      <div className="sticky top-0 hidden h-dvh p-3 lg:block">
        {showcase && <AuthShowcase {...showcase} />}
      </div>

      <CookieBanner />
      <ScrollRestoration />
    </div>
  )
}
