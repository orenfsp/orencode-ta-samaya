import { Outlet, ScrollRestoration, useLocation } from 'react-router'
import { routes } from '@/shared/config'
import { CookieBanner } from '@/widgets/cookie-banner'
import { Footer } from '@/widgets/footer'
import { Header, type NavItem } from '@/widgets/header'

// Только работающие разделы. Новые страницы добавляются сюда вместе с маршрутом. UI-кит — по адресу /design в dev, в меню его нет
const nav: NavItem[] = [
  { label: 'Новости', to: routes.news },
  { label: 'Соревнования', to: routes.competitions },
  { label: 'Календарь', to: routes.calendar },
  { label: 'Рейтинг', to: routes.ratings },
  { label: 'Сборные', to: routes.squads },
]

export function PublicLayout() {
  const { pathname } = useLocation()

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Перейти к содержимому
      </a>
      <Header nav={nav} />
      {/* key по пути: каждая страница мягко «всплывает» при переходе */}
      <main id="main" key={pathname} className="flex-1 animate-rise">
        <Outlet />
      </main>
      <Footer />
      <CookieBanner />
      <ScrollRestoration />
    </div>
  )
}
