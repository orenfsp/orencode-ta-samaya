from datetime import date, datetime
from uuid import UUID
from zoneinfo import ZoneInfo

from core.errors import Forbidden
from infrastructure.account.user import UserModel
from infrastructure.enums import CoachLinkStatus
from infrastructure.training.training_group import TrainingGroupModel
from profiles.repositories.pg_coach_links import CoachLinkRepository
from training.repositories.pg_groups import GroupRepository


def today() -> date:
    """Возвращает текущую дату по Оренбургу."""
    return datetime.now(ZoneInfo("Asia/Yekaterinburg")).date()


def full_name(user: UserModel) -> str:
    """Фамилия, имя и отчество человека."""
    return " ".join(part for part in (user.last_name, user.first_name, user.middle_name) if part)


class Access:
    """Права на группы и спортсменов: федерация — на всё, тренер — на свои группы и подопечных."""

    def __init__(self, groups: GroupRepository, links: CoachLinkRepository) -> None:
        """Сохраняет репозитории."""
        self._groups, self._links = groups, links

    @staticmethod
    def group(actor_id: UUID, is_federation: bool, group: TrainingGroupModel) -> None:
        """Пускает к группе федерацию и тренера группы; иначе бросает Forbidden."""
        if not is_federation and group.coach_id != actor_id:
            raise Forbidden("Группу ведёт другой тренер")

    async def coaches(self, athlete_id: UUID) -> set[UUID]:
        """Возвращает тренеров спортсмена: по активной связи и по группам, где он занимается."""
        links = {link.coach_id for link in await self._links.of_athlete(athlete_id) if link.status == CoachLinkStatus.ACTIVE}
        return links | set(await self._groups.athlete_coaches(athlete_id))

    async def athlete(self, actor_id: UUID, is_federation: bool, athlete_id: UUID) -> None:
        """Пускает к данным спортсмена его самого, его тренера и федерацию; иначе бросает Forbidden."""
        if is_federation or actor_id == athlete_id or actor_id in await self.coaches(athlete_id):
            return
        raise Forbidden("Данные спортсмена видят он сам, его тренер и федерация")
