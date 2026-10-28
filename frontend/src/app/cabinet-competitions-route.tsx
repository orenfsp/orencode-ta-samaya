import { useParams } from 'react-router'
import { CabinetCompetitionsPage } from '@/pages/cabinet-competitions'
import { CabinetMyContestsPage } from '@/pages/cabinet-my-contests'

/** Один раздел «Соревнования» на все роли: организатор и федерация ведут, спортсмен и тренер записываются */
export function CabinetCompetitionsRoute() {
  const role = useParams().role
  return role === 'athlete' || role === 'coach' ? <CabinetMyContestsPage /> : <CabinetCompetitionsPage />
}
