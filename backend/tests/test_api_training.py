import pytest

pytestmark = pytest.mark.integration


class TestTraining:
    def test_norms_public_from_order_445(self, anon) -> None:
        """Нормативы ФССП публичны: пороги по этапу и полу, направление сравнения."""
        norms = anon.get("/norms").json()
        assert len(norms) >= 35
        assert all(item["direction"] in ("lower", "higher") and item["stage"]["value"] for item in norms)

    def test_norms_admin_only_federation(self, login) -> None:
        """Справочник нормативов правит только федерация."""
        assert login("coach@example.test").get("/admin/norms").status_code == 403

    def test_coach_groups(self, login) -> None:
        """Тренер видит свои учебно-тренировочные группы с этапом и дисциплиной."""
        groups = login("coach@example.test").get("/training/groups").json()
        assert groups and groups[0]["stage"]["value"] and groups[0]["discipline"]["name"]

    def test_group_journal(self, login) -> None:
        """Журнал занятий группы доступен её тренеру."""
        session = login("coach@example.test")
        group = session.get("/training/groups").json()[0]
        assert session.get(f"/training/groups/{group['id']}/sessions").status_code == 200

    def test_athlete_cannot_create_group(self, login) -> None:
        """Спортсмен не создаёт учебные группы."""
        response = login("athlete@example.test").post("/training/groups", json={"name": "x"})
        assert response.status_code in (403, 422)

    def test_headcount_has_stage_cut(self, fed) -> None:
        """Численность считает и зачисления в группы: разрез по этапам подготовки."""
        report = fed.get("/admin/registry/headcount", params={"cut": "stage"}).json()
        assert report["rows"] and "in_groups" in report

    def test_judge_panel_reference_preview(self, fed, contests) -> None:
        """Справка о составе судейской коллегии строится по назначенной коллегии чемпионата."""
        contest = contests["Чемпионат Оренбургской области по алгоритмическому программированию"]["id"]
        response = fed.get(f"/admin/contests/{contest}/documents/judge_panel/preview", params={"title": "Справка"})
        assert response.status_code == 200 and response.content
