import { cn, passwordRules } from '@/shared/lib'
import { IconCheck } from './icons'

/** Правила пароля, которые отмечаются по мере ввода. Те же проверки делает бэк */
export function PasswordRules({ value, className }: { value: string; className?: string }) {
  return (
    <ul aria-label="Требования к паролю" className={cn('grid grid-cols-2 gap-x-4 gap-y-1.5', className)}>
      {passwordRules.map((rule) => {
        const ok = rule.test(value)
        return (
          <li
            key={rule.id}
            className={cn(
              'flex items-center gap-2 text-sm transition-colors duration-220',
              ok ? 'text-ink' : 'text-muted',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'grid size-4 shrink-0 place-items-center rounded-full transition-[background-color,scale] duration-260 ease-spring',
                ok ? 'scale-100 bg-primary text-white' : 'scale-90 bg-surface-3 text-transparent',
              )}
            >
              <IconCheck size={11} strokeWidth={3} />
            </span>
            {rule.label}
            <span className="sr-only">{ok ? ' — выполнено' : ' — не выполнено'}</span>
          </li>
        )
      })}
    </ul>
  )
}
