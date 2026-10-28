import type { ComponentType } from 'react'
import type { Role } from '@/entities/session'
import { routes } from '@/shared/config'
import {
  IconArrowUp,
  IconBook,
  IconCalendar,
  IconChart,
  IconFile,
  IconGrid,
  IconHistory,
  IconSettings,
  IconPodium,
  IconShieldCheck,
  IconText,
  IconTrophy,
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
          ? 'Заявки на разряды за спортсменов из ваших заявок'
          : 'Разряд, срок действия и заявка на следующий',
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
        competitions,
        {
          label: 'Мой рейтинг',
          to: routes.cabinetRating(role),
          icon: IconPodium,
          description: 'Своё место в рейтингах по дисциплинам и из чего сложились баллы',
        },
        qualification,
        documents,
      ]
    case 'coach':
      return [overview, competitions, qualification, documents]
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
