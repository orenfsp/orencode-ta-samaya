import type { Role, RoleStatus } from '@/entities/session'

/** Роли на модерации у федерации. Спортсмен подтверждается сразу и сюда не попадает */
export type ModeratedRole = Exclude<Role, 'athlete'>

export interface RoleRequest {
  id: string
  user: {
    id: string
    email: string
    last_name: string
    first_name: string
    middle_name: string | null
    birth_date: string
  }
  role: ModeratedRole
  status: RoleStatus
  reject_reason: string | null
  created_at: string
  decided_at: string | null
  decided_by: { id: string; email: string; last_name: string; first_name: string } | null
}

export interface RoleRequestFilters {
  role?: ModeratedRole
  status?: RoleStatus
  search?: string
}

export interface RoleRequestPage {
  items: RoleRequest[]
  total: number
}

export interface RoleRequestCounts {
  pending: Record<ModeratedRole, number>
}
