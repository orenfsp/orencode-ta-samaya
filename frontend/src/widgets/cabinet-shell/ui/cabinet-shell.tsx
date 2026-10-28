import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import type { Me, Role } from '@/entities/session'
import { routes } from '@/shared/config'
import { cn } from '@/shared/lib'
import { EmailVerifyStrip } from '@/features/email-verify'
import { useNotificationSync } from '@/features/notification-center'
import { BrandLogo, IconButton, IconClose, IconMenu } from '@/shared/ui'
import { OnboardingTour } from './onboarding-tour'
import { Sidebar } from './sidebar'

/**
 * Каркас кабинета: слева панель в стиле страниц входа (сетка, тонкая рамка), справа содержимое раздела.
 * На телефоне панель уезжает в выдвижное меню, сверху — как шапка сайта: логотип и меню.
 * Роль и раздел здесь не повторяем: они уже в строке над заголовком страницы.
 */
export function CabinetShell({ me, role, children }: { me: Me; role: Role; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()
  const hidden = useHideOnScroll()
  const unread = useNotificationSync(true)

  // Открытое мобильное меню не даёт листать страницу под собой
  useEffect(() => {
    document.documentElement.style.overflow = menuOpen ? 'hidden' : ''
    return () => void (document.documentElement.style.overflow = '')
  }, [menuOpen])

  return (
    <div className="mx-auto min-h-dvh max-w-shell lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh p-3 pr-0 lg:block">
        <div className="grid-texture h-full rounded-2xl border border-line-soft p-4">
          <Sidebar me={me} role={role} unread={unread} />
        </div>
      </aside>

      {/* Уезжает при прокрутке вниз и возвращается при прокрутке вверх — на телефоне место дороже */}
      <div
        className={cn(
          'sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line-soft bg-canvas/90 px-4 backdrop-blur transition-[translate] duration-260 ease-emphasized lg:hidden',
          hidden && !menuOpen && '-translate-y-full',
        )}
      >
        <Link to={routes.home} aria-label="На главную" className="rounded-sm">
          <BrandLogo className="h-7" />
        </Link>
        {/* Непрочитанные уведомления — точкой на кнопке меню: полоса остаётся «логотип + меню» */}
        <span className="relative">
          <IconButton
            aria-label={unread ? `Открыть меню, непрочитанных уведомлений: ${unread}` : 'Открыть меню'}
            aria-expanded={menuOpen}
            icon={<IconMenu />}
            size="sm"
            onClick={() => setMenuOpen(true)}
          />
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1 right-1 size-2 animate-pop-in rounded-full bg-live"
            />
          )}
        </span>
      </div>

      {/* Мобильное меню выезжает справа — оттуда, где кнопка. Всегда в DOM, чтобы выезд и уход были плавными */}
      <div
        inert={!menuOpen}
        className={cn(
          'fixed inset-0 z-40 lg:hidden',
          menuOpen ? 'pointer-events-auto' : 'pointer-events-none',
        )}
      >
        <div
          onClick={() => setMenuOpen(false)}
          className={cn(
            'absolute inset-0 bg-scrim transition-opacity duration-340',
            menuOpen ? 'opacity-100' : 'opacity-0',
          )}
        />
        <div
          className={cn(
            'grid-texture absolute inset-y-2 right-2 w-[min(20rem,calc(100%-3rem))] rounded-2xl border border-line-soft bg-canvas p-4',
            'transition-[translate] duration-340 ease-emphasized',
            menuOpen ? 'translate-x-0' : 'translate-x-[110%]',
          )}
        >
          <IconButton
            aria-label="Закрыть меню"
            icon={<IconClose />}
            size="sm"
            onClick={() => setMenuOpen(false)}
            className="absolute top-3 right-3"
          />
          <Sidebar me={me} role={role} unread={unread} onNavigate={() => setMenuOpen(false)} />
        </div>
      </div>

      <main
        id="main"
        key={pathname}
        className="min-w-0 animate-rise px-4 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10"
      >
        {!me.email_verified && pathname !== routes.cabinetSettings(role) && (
          <EmailVerifyStrip email={me.email} className="mb-8" />
        )}
        {children}
      </main>
      <OnboardingTour key={role} me={me} role={role} />
    </div>
  )
}

/** true, пока страницу листают вниз дальше шапки; любая прокрутка вверх — false */
function useHideOnScroll() {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    let last = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      if (Math.abs(y - last) < 8) return
      setHidden(y > last && y > 56)
      last = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return hidden
}
