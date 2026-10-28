import { StatusTag } from '@/shared/ui'
import { validity } from '../lib/validity'

/** Срок разряда или категории: «Действует до…», «Истекает через N дн.» (красным), «Истекла», «Бессрочно» */
export function ValidityTag({ validUntil, className }: { validUntil: string | null; className?: string }) {
  const { tone, label } = validity(validUntil)
  return (
    <StatusTag tone={tone} className={className}>
      {label}
    </StatusTag>
  )
}
