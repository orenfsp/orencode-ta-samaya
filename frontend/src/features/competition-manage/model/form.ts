import {
  isOnlineFormat,
  type CalendarPlan,
  type CompetitionFile,
  type CompetitionInput,
  type ManagedCompetition,
  type ParticipationType,
  type RatingPoint,
} from '@/entities/competition'
import { fromLocalInput, toLocalInput } from '@/shared/lib'

export const MAX_PHOTOS = 10
export const DOCUMENT_ACCEPT =
  'application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx'
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp'

/** Соревнование делит участников либо по возрасту, либо по учёбе */
export type GroupKind = 'none' | 'age' | 'academic'

export interface Draft {
  title: string
  description: string
  discipline_id: string
  contest_type_id: string
  contest_level_id: string
  contest_format_id: string
  participation_type: ParticipationType
  team_size_min: string
  team_size_max: string
  municipality_id: string
  venue: string
  group_kind: GroupKind
  age_group_ids: number[]
  academic_group_ids: number[]
  starts_on: string
  ends_on: string
  registration_opens_at: string
  registration_closes_at: string
  prize_fund_text: string
  prize_fund_amount: string
  calendar_plan: CalendarPlan
  calendar_plan_number: string
  regulations: CompetitionFile | null
  photos: CompetitionFile[]
  organizer_id: string
  verify_now: boolean
  rating_points: RatingPoint[]
}

export type Errors = Partial<Record<keyof Draft, string>>

const id = (value: number | null | undefined) => (value == null ? '' : String(value))
const num = (value: string) => (value.trim() === '' ? null : Number(value))

export function toDraft(item: ManagedCompetition | undefined, organizerId: string): Draft {
  return {
    title: item?.title ?? '',
    description: item?.description ?? '',
    discipline_id: id(item?.discipline.id),
    contest_type_id: id(item?.contest_type.id),
    contest_level_id: id(item?.contest_level.id),
    contest_format_id: id(item?.contest_format.id),
    participation_type: item?.participation_type ?? 'individual',
    team_size_min: id(item?.team_size_min),
    team_size_max: id(item?.team_size_max),
    municipality_id: id(item?.municipality?.id),
    venue: item?.venue ?? '',
    group_kind: item?.age_groups.length ? 'age' : item?.academic_groups.length ? 'academic' : 'none',
    age_group_ids: item?.age_groups.map((group) => group.id) ?? [],
    academic_group_ids: item?.academic_groups.map((group) => group.id) ?? [],
    starts_on: item?.starts_on ?? '',
    ends_on: item?.ends_on ?? '',
    registration_opens_at: item ? toLocalInput(item.registration_opens_at) : '',
    registration_closes_at: item ? toLocalInput(item.registration_closes_at) : '',
    prize_fund_text: item?.prize_fund_text ?? '',
    prize_fund_amount: id(item?.prize_fund_amount),
    calendar_plan: item?.calendar_plan ?? 'none',
    calendar_plan_number: item?.calendar_plan_number ?? '',
    regulations: item?.regulations ?? null,
    photos: item?.photos ?? [],
    organizer_id: item?.organizer.id ?? organizerId,
    verify_now: false,
    rating_points: [],
  }
}

/** Те же правила, что в домене бэка: заведомо неверное не отправляем */
export function validate(draft: Draft, formatName: string | undefined): Errors {
  const errors: Errors = {}
  if (!draft.title.trim()) errors.title = 'Введите название'
  if (!draft.discipline_id) errors.discipline_id = 'Выберите дисциплину'
  if (!draft.contest_type_id) errors.contest_type_id = 'Выберите тип'
  if (!draft.contest_level_id) errors.contest_level_id = 'Выберите уровень'
  if (!draft.contest_format_id) errors.contest_format_id = 'Выберите формат'
  if (draft.contest_format_id && !isOnlineFormat(formatName) && !draft.municipality_id)
    errors.municipality_id = 'Укажите, где проводится'
  if (draft.participation_type === 'team') {
    if (!draft.team_size_min || !draft.team_size_max) errors.team_size_max = 'Укажите размер команды'
    else if (Number(draft.team_size_max) < Number(draft.team_size_min))
      errors.team_size_max = 'Не может быть меньше минимума'
  }
  if (!draft.starts_on) errors.starts_on = 'Укажите дату начала'
  if (!draft.ends_on) errors.ends_on = 'Укажите дату окончания'
  else if (draft.starts_on && draft.ends_on < draft.starts_on) errors.ends_on = 'Не может быть раньше начала'
  if (!draft.registration_opens_at) errors.registration_opens_at = 'Укажите начало приёма заявок'
  if (!draft.registration_closes_at) errors.registration_closes_at = 'Укажите окончание приёма заявок'
  else if (draft.registration_opens_at && draft.registration_closes_at <= draft.registration_opens_at)
    errors.registration_closes_at = 'Должно быть позже открытия'
  else if (draft.starts_on && draft.registration_closes_at.slice(0, 10) > draft.starts_on)
    errors.registration_closes_at = 'Регистрация должна закрыться до начала соревнования'
  if (draft.prize_fund_amount && Number(draft.prize_fund_amount) < 0)
    errors.prize_fund_amount = 'Сумма не может быть отрицательной'
  if (draft.calendar_plan === 'none' && draft.calendar_plan_number.trim())
    errors.calendar_plan_number = 'Номер указывают вместе с календарным планом'
  if (draft.verify_now && !draft.rating_points.length)
    errors.rating_points = 'Укажите баллы хотя бы за одно место'
  return errors
}

export function toInput(draft: Draft, admin: boolean, creating: boolean): CompetitionInput {
  const team = draft.participation_type === 'team'
  const body: CompetitionInput = {
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    discipline_id: Number(draft.discipline_id),
    contest_type_id: Number(draft.contest_type_id),
    contest_level_id: Number(draft.contest_level_id),
    contest_format_id: Number(draft.contest_format_id),
    participation_type: draft.participation_type,
    team_size_min: team ? num(draft.team_size_min) : null,
    team_size_max: team ? num(draft.team_size_max) : null,
    municipality_id: draft.municipality_id ? Number(draft.municipality_id) : null,
    venue: draft.venue.trim() || null,
    age_group_ids: draft.group_kind === 'age' ? draft.age_group_ids : [],
    academic_group_ids: draft.group_kind === 'academic' ? draft.academic_group_ids : [],
    starts_on: draft.starts_on,
    ends_on: draft.ends_on,
    registration_opens_at: fromLocalInput(draft.registration_opens_at),
    registration_closes_at: fromLocalInput(draft.registration_closes_at),
    prize_fund_text: draft.prize_fund_text.trim() || null,
    prize_fund_amount: num(draft.prize_fund_amount),
    calendar_plan: draft.calendar_plan,
    calendar_plan_number: draft.calendar_plan === 'none' ? null : draft.calendar_plan_number.trim() || null,
    regulations_file_id: draft.regulations?.id ?? null,
    photo_file_ids: draft.photos.map((photo) => photo.id),
  }
  if (admin) body.organizer_id = draft.organizer_id
  if (admin && creating && draft.verify_now) body.rating_points = draft.rating_points
  return body
}
