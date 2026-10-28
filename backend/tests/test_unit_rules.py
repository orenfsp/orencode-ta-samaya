from datetime import date
from decimal import Decimal
from uuid import uuid4

import pytest

from applications.domain.eligibility import Eligibility
from deadlines.domain.deadlines import governor_due, threshold
from disputes.domain.disputes import shifted
from infrastructure.dictionaries.dictionary_age_group import DictionaryAgeGroupModel
from infrastructure.enums import CalendarPlan, QualificationKind, RatingSeason, Sanction
from infrastructure.qualifications.qualification import QualificationModel
from profiles.domain.organizations import mask_inn
from profiles.domain.sport_profiles import plus_year
from ratings.domain.ratings import Ratings, Rules, Score
from readiness.domain.readiness import expected_plan
from registry.domain.registry import covers
from results.domain.results import Results


def scores(*items: tuple[int | None, int]) -> list[Score]:
    """Места и баллы по порядку дат."""
    return [Score(index, f"Соревнование {index}", date(2026, 1, 1 + index), place, points) for index, (place, points) in enumerate(items)]


class TestRatingFormula:
    def test_case_example_102(self) -> None:
        """Пример кейса: 40 + 45 + 0 у призёра двух соревнований даёт 85 × 1,2 = 102."""
        total = Ratings.total(scores((1, 40), (2, 45), (5, 0)), Rules())
        assert (total.base, total.points, total.podiums) == (85, 102, 2)
        assert total.explain == "40 + 45 + 0 = 85 × 1,2 = 102"

    def test_one_podium_no_factor(self) -> None:
        """Одно призовое место — коэффициент не применяется."""
        total = Ratings.total(scores((1, 40), (4, 10)), Rules())
        assert total.points == 50 and total.factor is None and total.explain == "40 + 10 = 50"

    def test_single_start_explain(self) -> None:
        """У одного старта строка объяснения — просто баллы."""
        assert Ratings.total(scores((3, 20)), Rules()).explain == "20"

    def test_disqualification_not_podium(self) -> None:
        """Дисквалификация (место None) не считается призовым местом."""
        total = Ratings.total(scores((None, 0), (1, 40)), Rules())
        assert total.podiums == 1 and total.factor is None

    def test_custom_rules(self) -> None:
        """Коэффициент 1,5 и порог «только первое место» меняют итог."""
        assert Ratings.total(scores((1, 40), (2, 45)), Rules(factor=Decimal("1.5"))).points == 128
        assert Ratings.total(scores((1, 40), (2, 45)), Rules(podium_place=1)).factor is None

    def test_rounding_half_up(self) -> None:
        """Округление итога — половина вверх: 25 × 1,1 = 27,5 → 28."""
        assert Ratings.total(scores((1, 15), (1, 10)), Rules(factor=Decimal("1.1"))).points == 28

    def test_season_bounds(self) -> None:
        """Сезон: 365 дней назад или с 1 января."""
        today = date(2026, 10, 28)
        assert Ratings.since(today) == date(2025, 10, 28)
        assert Ratings.since(today, RatingSeason.CALENDAR) == date(2026, 1, 1)


class TestPlaces:
    @pytest.mark.parametrize(("places", "valid"), [([1, 2, 3], True), ([3, 1, 2], True), ([], True), ([1, 1, 2], False), ([1, 3], False), ([2, 3], False)])
    def test_places_consecutive(self, places: list[int], valid: bool) -> None:
        """Места идут подряд с 1 без повторов."""
        assert Results.places_valid(places) is valid

    def test_disqualification_shifts_others_up(self) -> None:
        """Дисквалификация снимает место, остальные поднимаются."""
        result = dict(shifted({10: 1, 11: 2, 12: 3, 13: None}, 11, Sanction.DISQUALIFICATION))
        assert result == {10: 1, 12: 2, 13: None, 11: None}

    def test_technical_defeat_goes_last(self) -> None:
        """Техническое поражение ставит заявку последней среди мест."""
        result = dict(shifted({10: 1, 11: 2, 12: 3}, 10, Sanction.TECHNICAL_DEFEAT))
        assert result == {11: 1, 12: 2, 10: 3}


class TestDeadlines:
    @pytest.mark.parametrize(("left", "expected"), [(45, None), (30, 30), (10, 30), (7, 7), (1, 1), (0, 1), (-3, 1)])
    def test_smallest_passed_threshold(self, left: int, expected: int | None) -> None:
        """Берётся наименьший пройденный порог напоминания."""
        assert threshold(left, (30, 7, 1)) == expected

    def test_governor_due(self) -> None:
        """Срок ходатайств — ближайшее 1 февраля."""
        assert governor_due(date(2026, 1, 15)) == date(2026, 2, 1)
        assert governor_due(date(2026, 10, 28)) == date(2027, 2, 1)

    def test_antidoping_year_on_leap_day(self) -> None:
        """Курс РУСАДА на год: 29 февраля переходит на 28 февраля."""
        assert plus_year(date(2028, 2, 29)) == date(2029, 2, 28)
        assert plus_year(date(2026, 3, 1)) == date(2027, 3, 1)


class TestEligibility:
    def test_age_on_birthday_boundary(self) -> None:
        """Полных лет: накануне дня рождения на год меньше."""
        assert Eligibility.age_on(date(2010, 5, 20), date(2026, 5, 19)) == 15
        assert Eligibility.age_on(date(2010, 5, 20), date(2026, 5, 20)) == 16

    def test_age_group_bounds_inclusive(self) -> None:
        """Границы возрастной группы включительно, пустая граница — без ограничения."""
        group = DictionaryAgeGroupModel(name="14–17 лет", min_age=14, max_age=17)
        assert [Eligibility.age_fits(group, age) for age in (13, 14, 17, 18)] == [False, True, True, False]
        assert Eligibility.age_fits(DictionaryAgeGroupModel(name="18+", min_age=18, max_age=None), 70)


class TestMisc:
    def test_qualification_signature_changes_with_order(self) -> None:
        """Подпись QR зависит от приказа: подмена номера ломает проверку."""
        item = QualificationModel(id=uuid4(), user_id=uuid4(), kind=QualificationKind.RANK, rank_type_id=6, token="abc",
                                  valid_from=date(2026, 1, 1), valid_until=date(2028, 1, 1), order_number="1-р")
        from qualifications.domain.qualifications import signature

        first = signature(item, b"secret")
        assert len(first) == 64 and first == signature(item, b"secret")
        item.order_number = "2-р"
        assert signature(item, b"secret") != first
        assert signature(item, b"other") != signature(item, b"secret")

    def test_inn_masked(self) -> None:
        """ИНН в публичном списке скрыт посередине."""
        assert mask_inn("5610000011") == "5610••••11"
        assert mask_inn(None) is None

    def test_period_half_open(self) -> None:
        """Период [начало, конец): в день окончания уже не действует."""
        assert covers(date(2025, 9, 1), None, date(2026, 1, 1))
        assert covers(date(2025, 9, 1), date(2026, 1, 1), date(2025, 12, 31))
        assert not covers(date(2025, 9, 1), date(2026, 1, 1), date(2026, 1, 1))

    @pytest.mark.parametrize(("level", "plan"), [("Всероссийское", CalendarPlan.EKP), ("Межрегиональное", CalendarPlan.EKP), ("Региональное", CalendarPlan.REGIONAL), ("Муниципальное", None)])
    def test_calendar_plan_by_level(self, level: str, plan: CalendarPlan | None) -> None:
        """Всероссийские и межрегиональные — в ЕКП, региональные — в КП области."""
        assert expected_plan(level) == plan
