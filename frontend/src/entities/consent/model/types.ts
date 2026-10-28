export type ConsentStatus = 'pending' | 'approved' | 'rejected'

export interface ConsentFile {
  id: string
  original_name: string
  url: string
}

/** Согласие законного представителя несовершеннолетнего: скан, кто представитель, решение федерации */
export interface Consent {
  id: string
  guardian_name: string
  guardian_phone: string
  file: ConsentFile
  status: ConsentStatus
  status_title: string
  reject_reason: string | null
  submitted_at: string
  decided_at: string | null
}

export interface MyConsent {
  /** Младше 18 — без одобренного согласия заявку не подать */
  required: boolean
  consent: Consent | null
}

export interface ConsentRow extends Consent {
  person: { id: string; full_name: string; email: string; birth_date: string }
}

export interface ConsentInput {
  guardian_name: string
  guardian_phone: string
  file_id: string
}
