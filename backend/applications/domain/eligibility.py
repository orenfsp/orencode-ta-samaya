from collections.abc import Sequence
from datetime import date

from auth.domain.roles import Roles
from infrastructure.contest import ContestModel
from infrastructure.dictionary_age_group import DictionaryAgeGroupModel
from infrastructure.enums import ParticipationType, Role
from infrastructure.user import UserModel


class Eligibility:
    @staticmethod
    def age_on(birth_date: date, on: date) -> int:
        return on.year - birth_date.year - ((on.month, on.day) < (birth_date.month, birth_date.day))

    @staticmethod
    def age_fits(group: DictionaryAgeGroupModel, age: int) -> bool:
        return (group.min_age is None or age >= group.min_age) and (group.max_age is None or age <= group.max_age)

    @classmethod
    def age_group(
        cls, user: UserModel, contest: ContestModel, catalog: Sequence[DictionaryAgeGroupModel]
    ) -> DictionaryAgeGroupModel | None:
        age = cls.age_on(user.birth_date, contest.starts_on)
        candidates = contest.age_groups or catalog
        return next((group for group in candidates if cls.age_fits(group, age)), None)

    @classmethod
    def problems(cls, user: UserModel, contest: ContestModel) -> list[str]:
        result: list[str] = []
        if Role.ATHLETE not in Roles.granted_roles(user):
            result.append("нет роли спортсмена")
        if contest.age_groups:
            age = cls.age_on(user.birth_date, contest.starts_on)
            if not any(cls.age_fits(group, age) for group in contest.age_groups):
                result.append(f"возраст на дату соревнования {age}, не подходит по возрастным группам")
        if user.academic_group_id is None:
            result.append("не указана академическая группа")
        elif contest.academic_groups and user.academic_group_id not in {
            group.id for group in contest.academic_groups
        }:
            name = user.academic_group.name if user.academic_group else "указанная"
            result.append(f"академическая группа «{name}» не допускается")
        return result

    @staticmethod
    def team_size_problem(contest: ContestModel, count: int, final: bool) -> str | None:
        if contest.participation_type != ParticipationType.TEAM:
            return None if count == 1 else "В личной заявке один участник"
        size_min, size_max = contest.team_size_min or 1, contest.team_size_max or count
        if count > size_max:
            return f"В команде не больше {size_max} участников"
        if final and count < size_min:
            return f"В команде должно быть не меньше {size_min} участников"
        return None
