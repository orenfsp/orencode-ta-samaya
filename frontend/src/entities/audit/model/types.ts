export interface AuditActor {
  id: string
  full_name: string
  email: string
}

export interface AuditEntry {
  id: string
  created_at: string
  user: AuditActor | null
  action: string
  action_label: string
  object_type: string | null
  object_label: string | null
  object_id: string | null
  payload: Record<string, unknown>
  ip: string | null
}

export interface AuditPage {
  items: AuditEntry[]
  total: number
}

export interface AuditCatalogEntry {
  code: string
  label: string
}

export interface AuditCatalog {
  actions: AuditCatalogEntry[]
  objects: AuditCatalogEntry[]
}

export interface AuditFilters {
  q?: string
  user_id?: string
  action?: string
  object_type?: string
  date_from?: string
  date_to?: string
}
