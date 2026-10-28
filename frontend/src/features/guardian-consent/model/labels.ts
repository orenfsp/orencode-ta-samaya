import type { ConsentStatus } from '@/entities/consent'
import type { StatusTone } from '@/shared/ui'

export const consentTones: Record<ConsentStatus, StatusTone> = {
  pending: 'draft',
  approved: 'active',
  rejected: 'cancelled',
}

export const consentStatusTitles: Record<ConsentStatus, string> = {
  pending: 'На проверке',
  approved: 'Одобрено',
  rejected: 'Отклонено',
}

export const CONSENT_ACCEPT =
  'application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp'
