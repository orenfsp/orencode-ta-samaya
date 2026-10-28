import type { Role } from '@/entities/session'
import { routes } from '@/shared/config'
import { cabinetNav } from './nav'

export interface TourStep {
  /** Что подсветить: значение data-tour; без цели — карточка по центру */
  target?: string
  title: string
  text: string
  /** Ссылка в конце шага: «Справочник понятий» */
  link?: { label: string; to: string }
}

/** Событие «показать навигатор снова»: кнопка в «Настройках» */
export const TOUR_EVENT = 'fsp:tour'

/** Открывает навигатор кабинета заново, с первого шага */
export const startTour = () => window.dispatchEvent(new Event(TOUR_EVENT))

const targets: Record<Role, string[]> = {
  athlete: [
    routes.cabinetCompetitions('athlete'),
    routes.cabinetAthleteProfile,
    routes.cabinetRating('athlete'),
    routes.cabinetQualification('athlete'),
    routes.cabinetDocuments('athlete'),
  ],
  coach: [
    routes.cabinetCoachAthletes,
    routes.cabinetCompetitions('coach'),
    routes.cabinetQualification('coach'),
    routes.cabinetDocuments('coach'),
    routes.cabinetDisputes('coach'),
  ],
  judge: [
    routes.cabinetJudgeAssignments,
    routes.cabinetQualification('judge'),
    routes.cabinetDocuments('judge'),
    routes.cabinetDeadlines('judge'),
  ],
  organizer: [
    routes.cabinetCompetitions('organizer'),
    routes.cabinetDeadlines('organizer'),
    routes.cabinetSettings('organizer'),
  ],
  federation: [
    routes.cabinetAccounts,
    routes.cabinetCompetitions('federation'),
    routes.cabinetQualificationsReview,
    routes.cabinetRegistry,
    routes.cabinetDisputes('federation'),
  ],
}

/** Шаги навигатора по роли: основные разделы меню с их описаниями, уведомления, справочник понятий */
export function tourSteps(role: Role): TourStep[] {
  return [
    ...cabinetNav(role)
      .filter((item) => targets[role].includes(item.to))
      .sort((a, b) => targets[role].indexOf(a.to) - targets[role].indexOf(b.to))
      .map((item) => ({ target: item.to, title: item.label, text: item.description })),
    {
      target: 'notifications',
      title: 'Уведомления',
      text: 'Решения, приглашения и сроки приходят сюда, на почту и в Telegram — как выберете в настройках.',
    },
    {
      title: 'Если встретится незнакомое слово',
      text: 'Верификация, коллегия, ЕВСК, баллы рейтинга — всё объяснено в справочнике понятий. Пройти навигатор заново можно в «Настройках».',
      link: {
        label: 'Справочник понятий',
        to: `${routes.glossary}#${role === 'athlete' ? 'rating' : role === 'judge' ? 'judge' : role === 'coach' ? 'coach' : 'verification'}`,
      },
    },
  ]
}
