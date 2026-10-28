import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { routes } from '@/shared/config'
import { cn } from '@/shared/lib'
import { useMe } from '@/entities/session'
import { buttonClass, IconClose, IconMenu, ThemeToggle } from '@/shared/ui'
import { NotificationCenter } from '@/features/notification-center'

export interface NavItem {
  label: string
  to: string
}

/**
 * Светлая плашка поверх тёмной страницы, как шапка fsp-russia.ru.
 * Пункты меню передаёт лейаут: в шапке только реально работающие разделы, без ссылок-пустышек.
 */
export function Header({ nav = [] }: { nav?: NavItem[] }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()
  const [menuPath, setMenuPath] = useState(pathname)

  // Переход по ссылке закрывает мобильное меню
  if (menuPath !== pathname) {
    setMenuPath(pathname)
    setMenuOpen(false)
  }

  return (
    <header className="sticky top-0 z-40 pt-2 sm:pt-3">
      <div className="container-page px-2! sm:px-4! xl:px-8!">
        <div className="rounded-lg bg-paper text-on-paper light:border light:border-line-soft">
          <div className="flex h-16 items-center gap-4 pr-2 pl-4 sm:h-[4.5rem] sm:pr-3 sm:pl-6">
            <Link to={routes.home} className="shrink-0 rounded-sm" aria-label="ФСП — на главную">
              <img src="/brand/fsp-logo.svg" alt="" className="hidden h-9 w-auto sm:block" />
              <img src="/brand/fsp-logo-compact.svg" alt="" className="h-8 w-auto sm:hidden" />
            </Link>

            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              {nav.length > 0 && (
                <nav aria-label="Основное меню" className="ml-auto hidden items-center gap-1 lg:flex">
                  {nav.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        cn(
                          'group relative px-3 py-2 text-body transition-colors duration-150',
                          isActive ? 'text-primary' : 'hover:text-primary',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {item.label}
                          <span
                            aria-hidden="true"
                            className={cn(
                              'absolute inset-x-3 bottom-1 h-px origin-left bg-current transition-[scale] duration-220 ease-emphasized',
                              isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100',
                            )}
                          />
                        </>
                      )}
                    </NavLink>
                  ))}
                </nav>
              )}
              <ThemeToggle tone="paper" />
              <NotificationCenter tone="paper" />
              <SessionActions />
              {nav.length > 0 && (
                <button
                  type="button"
                  aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
                  aria-expanded={menuOpen}
                  aria-controls="mobile-menu"
                  onClick={() => setMenuOpen((open) => !open)}
                  className="relative ml-auto grid size-11 pressable place-items-center rounded-md hover:bg-paper-2 lg:hidden"
                >
                  <IconMenu
                    className={cn(
                      'absolute transition-[opacity,rotate] duration-220',
                      menuOpen && 'rotate-90 opacity-0',
                    )}
                  />
                  <IconClose
                    className={cn(
                      'absolute transition-[opacity,rotate] duration-220',
                      !menuOpen && '-rotate-90 opacity-0',
                    )}
                  />
                </button>
              )}
            </div>
          </div>

          {nav.length > 0 && (
            <div
              id="mobile-menu"
              inert={!menuOpen}
              className={cn(
                'grid transition-[grid-template-rows] duration-340 ease-emphasized lg:hidden',
                menuOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
              )}
            >
              <div className="overflow-hidden">
                <nav aria-label="Основное меню" className="flex flex-col border-t border-paper-2 px-2 py-2">
                  {nav.map((item, index) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      style={{ transitionDelay: menuOpen ? `${80 + index * 30}ms` : '0ms' }}
                      className={({ isActive }) =>
                        cn(
                          'rounded-md px-3 py-3 text-body transition-[opacity,translate,background-color] duration-340 ease-emphasized',
                          menuOpen ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0',
                          isActive ? 'text-primary' : 'hover:bg-paper-2',
                        )
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </nav>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

/** Пока сессия не проверена — ничего, чтобы кнопки не мигали «Войти» → «Кабинет» */
function SessionActions() {
  const me = useMe()
  if (me.isPending) return null
  if (me.data) {
    return (
      <Link to={routes.cabinet} className={buttonClass({ size: 'sm', className: 'sm:min-h-10' })}>
        Кабинет
      </Link>
    )
  }
  return (
    <>
      <Link
        to={routes.login}
        className="pressable rounded-md px-3 py-2 text-body transition-colors duration-150 hover:bg-paper-2"
      >
        Войти
      </Link>
      <span className="hidden sm:contents">
        <Link to={routes.register} className={buttonClass({ size: 'sm', className: 'sm:min-h-10' })}>
          Регистрация
        </Link>
      </span>
    </>
  )
}
