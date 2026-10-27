import type { StatusTone, VerificationState } from '@/shared/ui'
import type {
  Competition,
  CompetitionAction,
  CompetitionStatus,
  ParticipationType,
  VerificationStatus,
} from '../model/types'

/** Переходы по статусу — ровно таблица «Кнопки по статусу» из docs/009_front_competitions.md */
export const statusActions: Record<CompetitionStatus, CompetitionAction[]> = {
  draft: ['publish'],
  published: ['open-registration', 'start', 'unpublish'],
  registration_open: ['close-registration', 'start'],
  registration_closed: ['open-registration', 'start'],
  in_progress: ['complete'],
  completed: ['archive'],
  cancelled: ['archive'],
  archived: [],
}

const cancellable: CompetitionStatus[] = ['draft', 'published', 'registration_open', 'registration_closed']
const deletable: CompetitionStatus[] = [...cancellable, 'cancelled']

export const canCancel = (status: CompetitionStatus) => cancellable.includes(status)
export const canDelete = (status: CompetitionStatus) => deletable.includes(status)
export const canEdit = (status: CompetitionStatus) => status !== 'archived'

/** Черновик и архив наружу не видны — ссылку «на сайте» показываем только для остальных */
export const isPublic = (status: CompetitionStatus) => status !== 'draft' && status !== 'archived'

export function actionLabel(action: CompetitionAction, status: CompetitionStatus) {
  if (action === 'open-registration' && status === 'registration_closed') return 'Открыть регистрацию снова'
  return {
    publish: 'Опубликовать',
    unpublish: 'Снять с публикации',
    'open-registration': 'Открыть регистрацию',
    'close-registration': 'Закрыть регистрацию',
    start: 'Начать',
    complete: 'Завершить',
    archive: 'В архив',
  }[action]
}

/** Статус → тон StatusTag: «идёт» — красная живая точка, открытая регистрация — синяя */
export const statusTone: Record<CompetitionStatus, StatusTone> = {
  draft: 'draft',
  published: 'active',
  registration_open: 'active',
  registration_closed: 'done',
  in_progress: 'live',
  completed: 'done',
  archived: 'done',
  cancelled: 'cancelled',
}

/** Верификация → состояние щита VerifiedMark; «не запрошена» — без щита */
export const verificationMark: Record<VerificationStatus, VerificationState | null> = {
  not_requested: null,
  pending: 'pending',
  verified: 'verified',
  rejected: 'rejected',
}

export const participationLabels: Record<ParticipationType, string> = {
  individual: 'Личное',
  team: 'Командное',
}

/** Поля, правка которых организатором возвращает верификацию «На проверку» */
export const ratingFields = [
  'discipline_id',
  'contest_level_id',
  'participation_type',
  'team_size_min',
  'team_size_max',
  'age_group_ids',
  'academic_group_ids',
  'starts_on',
  'ends_on',
] as const

/** «Онлайн» по формату соревнования: у такого муниципалитет не нужен */
export const isOnlineFormat = (formatName: string | undefined) =>
  Boolean(formatName?.toLowerCase().includes('онлайн'))

export function teamSize(competition: Pick<Competition, 'team_size_min' | 'team_size_max'>) {
  const { team_size_min: min, team_size_max: max } = competition
  if (min == null || max == null) return null
  return min === max ? `${min} чел.` : `${min}–${max} чел.`
}

export function competitionPlace(competition: Pick<Competition, 'municipality' | 'venue'>) {
  return [competition.municipality?.name, competition.venue].filter(Boolean).join(', ')
}

export const statusTitles: Record<CompetitionStatus, string> = {
  draft: 'Черновик',
  published: 'Опубликовано',
  registration_open: 'Регистрация открыта',
  registration_closed: 'Регистрация закрыта',
  in_progress: 'Идёт',
  completed: 'Завершено',
  archived: 'В архиве',
  cancelled: 'Отменено',
}

export const verificationTitles: Record<VerificationStatus, string> = {
  not_requested: 'Не запрошена',
  pending: 'На проверке',
  verified: 'Верифицировано',
  rejected: 'Отказано',
}
