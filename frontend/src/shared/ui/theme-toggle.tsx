import { cn, setTheme, useTheme } from '@/shared/lib'
import { IconMoon, IconSun } from './icons'

/**
 * Переключатель светлой и тёмной темы. tone="paper" — для светлой плашки шапки, иначе — для фона страницы.
 * Иконки меняются поворотом; сама тема раскрывается кругом от кнопки.
 */
export function ThemeToggle({
  tone = 'canvas',
  className,
}: {
  tone?: 'canvas' | 'paper'
  className?: string
}) {
  const theme = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  const label = next === 'light' ? 'Светлая тема' : 'Тёмная тема'

  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        setTheme(next, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
      }}
      className={cn(
        'relative grid size-10 shrink-0 pressable place-items-center rounded-md',
        tone === 'paper' ? 'text-on-paper hover:bg-paper-2' : 'text-ink hover:bg-hover-tint',
        className,
      )}
    >
      <IconSun
        size={19}
        className={cn(
          'absolute transition-[opacity,rotate,scale] duration-340 ease-emphasized',
          theme === 'light' ? 'rotate-0 opacity-100' : 'scale-50 -rotate-90 opacity-0',
        )}
      />
      <IconMoon
        size={19}
        className={cn(
          'absolute transition-[opacity,rotate,scale] duration-340 ease-emphasized',
          theme === 'dark' ? 'rotate-0 opacity-100' : 'scale-50 rotate-90 opacity-0',
        )}
      />
    </button>
  )
}
