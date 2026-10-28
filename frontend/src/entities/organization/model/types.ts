import type { Ref } from '@/entities/competition'

/** Организация спортивной подготовки: школа, вуз, спортшкола, клуб */
export interface Organization {
  id: number
  name: string
  short_name: string | null
  organization_type: Ref
  municipality: Ref | null
  /** Публично — маской, федерации — полностью */
  inn: string | null
  address: string | null
  website: string | null
  license_number: string | null
  license_date: string | null
  is_active: boolean
  /** Спортсменов с этой организацией в профиле */
  athletes: number
}

export interface OrganizationInput {
  name?: string
  short_name?: string | null
  organization_type_id?: number
  municipality_id?: number | null
  inn?: string | null
  address?: string | null
  website?: string | null
  license_number?: string | null
  license_date?: string | null
  is_active?: boolean
}

export interface OrganizationQuery {
  q?: string
  municipality_id?: number
  organization_type_id?: number
  limit: number
  offset: number
}
