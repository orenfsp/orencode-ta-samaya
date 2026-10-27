import type { ComponentType } from 'react'
import type { Role } from '@/entities/session'
import { routes } from '@/shared/config'
import {
  IconBook,
  IconCalendar,
  IconCheckCircle,
  IconGrid,
  IconShieldCheck,
  IconText,
  IconTrophy,
  IconUser,
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
        ? 'Все соревнования региона и очередь верификации'
        : 'Свои соревнования: создание, публикация, верификация',
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
        competitions,
        {
          label: 'Модерация участников',
          to: routes.cabinetParticipants(role),
          icon: IconCheckCircle,
          description: 'Заявки на соревнования: одобрить, отклонить, вернуть',
        },
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
      ]
    case 'organizer':
      return [
        overview,
        competitions,
        {
          label: 'Модерация участников',
          to: routes.cabinetParticipants(role),
          icon: IconUser,
          description: 'Заявки на ваши соревнования: одобрить или отклонить',
        },
      ]
    case 'athlete':
    case 'coach':
      return [
        overview,
        {
          label: 'Мои соревнования',
          to: routes.cabinetMyContests(role),
          icon: IconTrophy,
          description:
            role === 'coach'
              ? 'Заявки за подопечных: личные и команды'
              : 'Заявки, приглашения в команды и запись на новые соревнования',
        },
      ]
    default:
      return [overview]
  }
}
