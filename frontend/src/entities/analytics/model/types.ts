export type AnalyticsBlock =
  | 'summary'
  | 'participants'
  | 'contests'
  | 'applications'
  | 'retention'
  | 'demographics'
  | 'coaches'
  | 'judges'
  | 'qualifications'
  | 'disciplines'

export interface AnalyticsQuery {
  date_from?: string
  date_to?: string
  discipline_id?: string
  municipality_id?: string
  group_kind?: 'age' | 'academic'
  group_id?: string
}

/** Показатель за период и за прошлый период той же длины. pct — null, если в прошлом был ноль */
export interface Delta {
  value: number
  previous: number
  diff: number
  pct: number | null
}

export interface NamedCount {
  name: string
  value: number
  previous: number
}

interface Month {
  month: string
  label: string
}

interface Base<B extends AnalyticsBlock> {
  block: B
  title: string
  period: { from: string; to: string }
  previous: { from: string; to: string }
}

export interface SummaryData extends Base<'summary'> {
  tiles: Record<
    'participants' | 'newcomers' | 'starts' | 'contests' | 'approval_rate' | 'retention' | 'qualifications',
    Delta
  >
}

export interface ParticipantsData extends Base<'participants'> {
  months: (Month & { participants: number; newcomers: number; starts: number })[]
  totals: Record<'participants' | 'newcomers' | 'starts', Delta>
}

export interface ContestsData extends Base<'contests'> {
  total: Delta
  levels: NamedCount[]
  formats: NamedCount[]
  statuses: NamedCount[]
}

export interface ApplicationsData extends Base<'applications'> {
  counts: Record<'approved' | 'rejected' | 'submitted' | 'withdrawn', Delta>
  reasons: { reason: string; count: number }[]
}

export interface RetentionData extends Base<'retention'> {
  rate: Delta
  kept: number
  base: number
  cohorts: (Month & { size: number; m1: number; m3: number; m6: number })[]
}

export interface DemographicsData extends Base<'demographics'> {
  municipalities: NamedCount[]
  ages: NamedCount[]
  academic: NamedCount[]
}

export interface CoachRow {
  id: string
  name: string
  points: number
  previous_points: number
  athletes: number
  starts: number
  podiums: number
}

export interface CoachesData extends Base<'coaches'> {
  items: CoachRow[]
  total_points: Delta
}

export interface JudgeRow {
  id: string
  name: string
  category: string | null
  contests: number
  days: number
  chief: number
}

export interface JudgesData extends Base<'judges'> {
  items: JudgeRow[]
  average: Delta
  without_panel: Delta
  judges: Delta
}

export interface QualificationsData extends Base<'qualifications'> {
  months: (Month & { ranks: number; categories: number })[]
  by_name: { kind: 'rank' | 'judge_category'; name: string; value: number }[]
  totals: Record<'ranks' | 'categories', Delta>
}

export interface DisciplineRow {
  id: number
  name: string
  participants: Delta
  newcomers: Delta
  contests: Delta
  applications: Delta
  approved: Delta
  points: Delta
}

export interface DisciplinesData extends Base<'disciplines'> {
  items: DisciplineRow[]
}

export interface AnalyticsData {
  summary: SummaryData
  participants: ParticipantsData
  contests: ContestsData
  applications: ApplicationsData
  retention: RetentionData
  demographics: DemographicsData
  coaches: CoachesData
  judges: JudgesData
  qualifications: QualificationsData
  disciplines: DisciplinesData
}
