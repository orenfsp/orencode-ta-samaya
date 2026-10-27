import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/shared/lib'
import { IconCheck, IconMinus } from './icons'

interface ChoiceProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Без подписи (чекбокс в строке таблицы) — обязателен aria-label */
  label?: ReactNode
  description?: ReactNode
}

function ChoiceLabel({ label, description }: Pick<ChoiceProps, 'label' | 'description'>) {
  if (label == null) return null
  return (
    <span className="flex flex-col gap-0.5 pt-px">
      <span className="text-body text-ink">{label}</span>
      {description && <span className="text-sm text-muted">{description}</span>}
    </span>
  )
}

const rowClass =
  'group inline-flex cursor-pointer items-start gap-3 has-disabled:cursor-not-allowed has-disabled:opacity-50'

const boxBase =
  'peer shrink-0 cursor-pointer appearance-none border border-line bg-surface-2 transition-[background-color,border-color,box-shadow] duration-180 ease-standard group-hover:border-primary checked:border-primary checked:bg-primary disabled:cursor-not-allowed'

/** indeterminate — «выбрана часть» у «Выбрать все» над списком */
export function Checkbox({
  label,
  description,
  className,
  indeterminate = false,
  ...props
}: ChoiceProps & { indeterminate?: boolean }) {
  return (
    <label className={cn(rowClass, className)}>
      <span className="relative mt-0.5 grid size-5 shrink-0 place-items-center">
        <input
          type="checkbox"
          {...props}
          // indeterminate есть только у DOM-узла, атрибутом его не задать
          ref={(node) => {
            if (node) node.indeterminate = indeterminate
          }}
          className={cn(boxBase, 'size-5 rounded-xs indeterminate:border-primary indeterminate:bg-primary')}
        />
        <IconCheck
          size={14}
          strokeWidth={2.5}
          className="pointer-events-none absolute scale-50 text-white opacity-0 transition-[opacity,scale] duration-220 ease-spring peer-checked:scale-100 peer-checked:opacity-100"
        />
        <IconMinus
          size={14}
          strokeWidth={2.5}
          className="pointer-events-none absolute scale-50 text-white opacity-0 transition-[opacity,scale] duration-220 ease-spring peer-indeterminate:scale-100 peer-indeterminate:opacity-100"
        />
      </span>
      <ChoiceLabel label={label} description={description} />
    </label>
  )
}

export function Radio({ label, description, className, ...props }: ChoiceProps) {
  return (
    <label className={cn(rowClass, className)}>
      <span className="relative mt-0.5 grid size-5 shrink-0 place-items-center">
        <input type="radio" {...props} className={cn(boxBase, 'size-5 rounded-full')} />
        <span className="pointer-events-none absolute size-2 scale-0 rounded-full bg-white transition-[scale] duration-220 ease-spring peer-checked:scale-100" />
      </span>
      <ChoiceLabel label={label} description={description} />
    </label>
  )
}

export function Switch({ label, description, className, ...props }: ChoiceProps) {
  return (
    <label className={cn(rowClass, className)}>
      <span className="relative mt-px inline-flex h-6 w-10 shrink-0">
        <input
          type="checkbox"
          role="switch"
          {...props}
          className="peer h-6 w-10 cursor-pointer appearance-none rounded-full bg-line transition-colors duration-220 ease-standard checked:bg-primary disabled:cursor-not-allowed"
        />
        <span className="pointer-events-none absolute top-0.5 left-0.5 size-5 rounded-full bg-white transition-[translate,width] duration-260 ease-spring group-active:w-6 peer-checked:translate-x-4 peer-checked:group-active:translate-x-3" />
      </span>
      <ChoiceLabel label={label} description={description} />
    </label>
  )
}
