import { roleLabels, type SelfRole } from '@/entities/session'
import { cn } from '@/shared/lib'
import { IconCheck } from '@/shared/ui'

const options: { role: SelfRole; description: string; access: string; instant: boolean }[] = [
  {
    role: 'athlete',
    description: 'Заявки на соревнования, история выступлений, разряды',
    access: 'Сразу',
    instant: true,
  },
  {
    role: 'coach',
    description: 'Свои спортсмены, заявки за них, их разряды',
    access: 'Сразу · проверка ФСП по желанию даёт значок',
    instant: true,
  },
  {
    role: 'judge',
    description: 'Категория и её срок, назначения на соревнования',
    access: 'После проверки ФСП',
    instant: false,
  },
  {
    role: 'organizer',
    description: 'Заявки на проведение соревнований и их протоколы',
    access: 'После проверки ФСП',
    instant: false,
  },
  {
    role: 'federation',
    description: 'Справочники, соревнования региона, календарь, модерация аккаунтов',
    access: 'После подтверждения другим сотрудником ФСП',
    instant: false,
  },
]

/** Выбор нескольких ролей карточками. Под капотом — группа чекбоксов: клавиатура и скринридер из коробки */
export function RolePicker({
  value,
  onChange,
  invalid,
}: {
  value: SelfRole[]
  onChange: (roles: SelfRole[]) => void
  invalid?: boolean
}) {
  const toggle = (role: SelfRole) =>
    onChange(value.includes(role) ? value.filter((item) => item !== role) : [...value, role])

  return (
    <fieldset className="flex flex-col gap-2.5" aria-invalid={invalid || undefined}>
      <legend className="sr-only">Роли аккаунта</legend>
      {options.map((option, index) => {
        const checked = value.includes(option.role)
        return (
          <label
            key={option.role}
            style={{ animationDelay: `${index * 50}ms` }}
            className={cn(
              'group relative flex animate-rise cursor-pointer items-start gap-4 rounded-lg border p-4',
              'transition-[border-color,background-color,translate] duration-220 ease-emphasized has-focus-visible:field-focus',
              checked
                ? 'border-primary bg-primary-soft'
                : 'border-line-soft bg-surface-2 hover:-translate-y-0.5 hover:border-line',
            )}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(option.role)}
              className="sr-only"
            />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-lead font-medium text-ink">{roleLabels[option.role]}</span>
              <span className="text-sm text-muted">{option.description}</span>
              <span
                className={cn(
                  'mt-1.5 inline-flex items-center gap-1.5 self-start text-sm',
                  option.instant ? 'text-ink' : 'text-muted',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn('size-1.5 rounded-full', option.instant ? 'bg-primary' : 'bg-line')}
                />
                {option.access}
              </span>
            </span>
            <span
              aria-hidden="true"
              className={cn(
                'grid size-6 shrink-0 place-items-center rounded-sm border transition-[background-color,border-color] duration-180',
                checked ? 'border-primary bg-primary text-white' : 'border-line text-transparent',
              )}
            >
              <IconCheck
                size={15}
                strokeWidth={2.5}
                className={cn(
                  'transition-[scale] duration-260 ease-spring',
                  checked ? 'scale-100' : 'scale-0',
                )}
              />
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}
