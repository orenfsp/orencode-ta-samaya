import type { AppealStatus, ViolationStatus } from '@/entities/dispute'
import type { StatusTone } from '@/shared/ui'

export const appealTone: Record<AppealStatus, StatusTone> = {
  submitted: 'active',
  reviewing: 'live',
  upheld: 'done',
  rejected: 'cancelled',
  withdrawn: 'draft',
}

export const violationTone: Record<ViolationStatus, StatusTone> = {
  reported: 'live',
  decided: 'done',
  dismissed: 'draft',
}
