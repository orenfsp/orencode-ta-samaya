import type { ComponentType } from 'react'
import type { Role } from '@/entities/session'
import { routes } from '@/shared/config'
import {
  IconAlert,
  IconArrowUp,
  IconBook,
  IconCalendar,
  IconChart,
  IconCheckCircle,
  IconInbox,
  IconFile,
  IconGrid,
  IconHistory,
  IconSettings,
  IconPodium,
  IconShieldCheck,
  IconText,
  IconTrophy,
  IconUser,
  IconMapPin,
  type IconProps,
} from '@/shared/ui'

export interface CabinetNavItem {
  label: string
  to: string
  icon: ComponentType<IconProps>
  /** Одна строка: что внутри раздела. Из неё собираются карточки «Обзора» */
  description: string
  /** Акцент раздела на «Обзоре»: события ФСП — красные, как в календаре */
  tone?: 'primary' | 'live'
  /** Активен только при точном совпадении пути (для «Обзора», чтобы не горел на вложенных) */
  end?: boolean
}

/** Разделы кабинета по ролям. Только то, что уже работает: пустых пунктов меню нет */
export function cabinetNav(role: Role): CabinetNavItem[] {
  return [
    ...sections(role),
    {
      label: 'Сроки',
      to: routes.cabinetDeadlines(role),
      icon: IconCalendar,
      description:
        role === 'federation'
          ? 'Приём заявок, истекающие разряды и категории, премии Губернатора, отчёты'
          : 'Приём заявок и сроки разряда, категории, антидопингового курса',
    },
    {
      label: 'Настройки',
      to: routes.cabinetSettings(role),
      icon: IconSettings,
      description:
        role === 'federation'
          ? 'Почта, Telegram, каналы уведомлений, администраторы бота'
          : 'Почта, Telegram и какие уведомления куда присылать',
    },
  ]
}

function sections(role: Role): CabinetNavItem[] {
  const overview: CabinetNavItem = {
    label: 'Обзор',
    to: routes.cabinetRole(role),
    icon: IconGrid,
    description: 'Разделы кабинета и роли аккаунта',
    end: true,
  }
  const competitions: CabinetNavItem = {
    label: 'Соревнования',
    to: routes.cabinetCompetitions(role),
    icon: IconTrophy,
    description:
      role === 'federation'
        ? 'Все соревнования региона, верификация и заявки участников'
        : role === 'organizer'
          ? 'Свои соревнования: создание, публикация, заявки участников'
          : role === 'coach'
            ? 'Запись подопечных: личные заявки и команды'
            : 'Запись, заявки и приглашения в команды',
  }
  const documents: CabinetNavItem = {
    label: 'Мои документы',
    to: routes.cabinetDocuments(role),
    icon: IconFile,
    description:
      role === 'coach'
        ? 'Благодарности и справки о подготовке спортсменов с QR-кодом'
        : role === 'judge'
          ? 'Справки о судействе с QR-кодом'
          : 'Сертификаты, дипломы, грамоты и справки об участии с QR-кодом',
  }
  const qualification: CabinetNavItem = {
    label: role === 'judge' ? 'Моя категория' : role === 'coach' ? 'Разряды спортсменов' : 'Мой разряд',
    to: routes.cabinetQualification(role),
    icon: role === 'judge' ? IconShieldCheck : IconArrowUp,
    description:
      role === 'judge'
        ? 'Судейская категория, срок действия и заявка на повышение'
        : role === 'coach'
          ? 'Заявки на разряды за ваших спортсменов'
          : 'Разряд, срок действия и заявка на следующий',
  }
  const disputes: CabinetNavItem = {
    label: role === 'federation' ? 'Апелляции и нарушения' : 'Мои апелляции',
    to: routes.cabinetDisputes(role),
    icon: IconAlert,
    description:
      role === 'federation'
        ? 'Апелляции на места и рапорты судей: рассмотрение и решение'
        : 'Апелляции по своим заявкам и решения федерации по нарушениям',
  }
  switch (role) {
    case 'federation':
      return [
        overview,
        {
          label: 'Справочники',
          to: routes.dictionaries(),
          icon: IconBook,
          description: 'Дисциплины, муниципалитеты, возрастные группы, разряды и другие списки',
        },
        {
          label: 'Модерация аккаунтов',
          to: routes.cabinetAccounts,
          icon: IconShieldCheck,
          description: 'Подтверждение тренеров, судей, организаций и сотрудников ФСП',
        },
        {
          label: 'Разряды и категории',
          to: routes.cabinetQualificationsReview,
          icon: IconArrowUp,
          description: 'Очереди заявок на судейские категории и спортивные разряды',
        },
        disputes,
        {
          label: 'Реестр',
          to: routes.cabinetRegistry,
          icon: IconUser,
          description: 'Спортсмены, тренеры и судьи с фильтрами, численность занимающихся по годам',
        },
        {
          label: 'Организации',
          to: routes.cabinetOrganizations,
          icon: IconMapPin,
          description: 'Школы, вузы, спортивные школы и клубы: лицензия, программы подготовки, тренеры',
        },
        {
          label: 'Группы',
          to: routes.cabinetTraining(role),
          icon: IconInbox,
          description: 'Учебно-тренировочные группы по этапам, журнал занятий, аттестация',
        },
        {
          label: 'Нормативы',
          to: routes.cabinetNorms,
          icon: IconCheckCircle,
          description: 'Нормативы ОФП и СФП по федеральному стандарту: этап, дисциплина, пол',
        },
        competitions,
        {
          label: 'События',
          to: routes.calendarAdmin,
          icon: IconCalendar,
          tone: 'live',
          description: 'Лекции, сборы и вебинары для общего календаря',
        },
        {
          label: 'Новости',
          to: routes.newsAdmin,
          icon: IconText,
          description: 'Статьи федерации: черновики, публикация, архив',
        },
        {
          label: 'Аналитика',
          to: routes.cabinetAnalytics,
          icon: IconChart,
          description: 'Участники, заявки, тренеры и судьи за период и выгрузка в xlsx',
        },
        {
          label: 'Журнал действий',
          to: routes.cabinetAudit,
          icon: IconHistory,
          description: 'Кто, что и когда изменил: роли, соревнования, заявки, статьи',
        },
      ]
    case 'athlete':
      return [
        overview,
        {
          label: 'Профиль спортсмена',
          to: routes.cabinetAthleteProfile,
          icon: IconUser,
          description: 'Организация, дисциплины, тренеры и антидопинговый курс',
        },
        {
          label: 'Подготовка',
          to: routes.cabinetTraining(role),
          icon: IconBook,
          description: 'Группа и этап, посещаемость, нормативы и аттестации',
        },
        competitions,
        {
          label: 'Мой рейтинг',
          to: routes.cabinetRating(role),
          icon: IconPodium,
          description: 'Своё место в рейтингах по дисциплинам и из чего сложились баллы',
        },
        qualification,
        documents,
        disputes,
      ]
    case 'coach':
      return [
        overview,
        {
          label: 'Мои спортсмены',
          to: routes.cabinetCoachAthletes,
          icon: IconUser,
          description: 'Привязка по дисциплине с подтверждением, статусы и история',
        },
        {
          label: 'Группы',
          to: routes.cabinetTraining(role),
          icon: IconBook,
          description: 'Состав групп, журнал занятий, приём нормативов и аттестация',
        },
        competitions,
        qualification,
        documents,
        disputes,
      ]
    case 'judge':
      return [
        overview,
        qualification,
        {
          label: 'Мои назначения',
          to: routes.cabinetJudgeAssignments,
          icon: IconCalendar,
          description: 'Соревнования, в коллегию которых вы назначены, и должность',
        },
        documents,
      ]
    case 'organizer':
      return [overview, competitions]
    default:
      return [overview]
  }
}
