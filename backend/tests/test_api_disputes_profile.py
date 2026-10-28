from datetime import date

import pytest

pytestmark = pytest.mark.integration

LYCEUM = "Внутренний турнир лицея № 1 по алгоритмике"
AI = "Олимпиада школьников по искусственному интеллекту"


class TestDisputes:
    def test_queue_federation_only(self, fed, login) -> None:
        """Очередь апелляций видит федерация, спортсмену — 403."""
        queue = fed.get("/admin/disputes").json()
        assert queue["appeals"] and queue["violations"]
        assert login("athlete@example.test").get("/admin/disputes").status_code == 403

    def test_appeal_lifecycle(self, login, contests) -> None:
        """Апелляция: подать, дубль — 409, отозвать."""
        session = login("14-17-10-11.5@example.test")
        contest = contests[LYCEUM]["id"]
        view = session.get(f"/contests/{contest}/disputes").json()
        entry = view["entries"][0]["application_id"]
        response = session.post(f"/contests/{contest}/appeals", json={"application_id": entry, "reason": "Проверьте задачу C"})
        assert response.status_code == 201, response.text
        appeal = response.json()["id"]
        duplicate = session.post(f"/contests/{contest}/appeals", json={"application_id": entry, "reason": "Ещё раз"})
        assert duplicate.status_code == 409 and duplicate.json()["error"]["code"] == "appeal_exists"
        assert session.post(f"/appeals/{appeal}/withdraw").json()["status"] == "withdrawn"

    def test_appeal_validation(self, login, contests) -> None:
        """Пустая причина и ссылка не http — 422."""
        session = login("14-17-10-11.5@example.test")
        contest = contests[LYCEUM]["id"]
        entry = session.get(f"/contests/{contest}/disputes").json()["entries"][0]["application_id"]
        assert session.post(f"/contests/{contest}/appeals", json={"application_id": entry, "reason": " "}).status_code == 422
        assert session.post(f"/contests/{contest}/appeals", json={"application_id": entry, "reason": "x", "evidence_url": "ftp://x"}).status_code == 422

    def test_outsider_cannot_appeal(self, login, contests) -> None:
        """Чужую заявку оспорить нельзя — 403."""
        owner = login("14-17-10-11.5@example.test")
        contest = contests[LYCEUM]["id"]
        entry = owner.get(f"/contests/{contest}/disputes").json()["entries"][0]["application_id"]
        response = login("u14-5-9.1@example.test").post(f"/contests/{contest}/appeals", json={"application_id": entry, "reason": "x"})
        assert response.status_code == 403

    def test_violation_only_panel_judge(self, login, contests) -> None:
        """Рапорт о нарушении — только судья коллегии этого соревнования."""
        judge = login("judge@example.test")
        view = judge.get(f"/contests/{contests[AI]['id']}/disputes").json()
        assert view["can_report"] and view["participants"]
        target = view["participants"][0]["athlete"]["id"]
        assert login("coach@example.test").post(f"/contests/{contests[AI]['id']}/violations", json={"user_id": target, "description": "x"}).status_code == 403

    def test_suspension_requires_future_date(self, fed) -> None:
        """Отстранение без будущей даты — 422."""
        reported = [item for item in fed.get("/admin/disputes").json()["violations"] if item["status"] == "reported"]
        assert reported
        response = fed.post(f"/admin/violations/{reported[0]['id']}/decide", json={"sanction": "suspension", "decision": "x", "suspended_until": date.today().isoformat()})
        assert response.status_code == 422

    def test_appealable_from_cabinet(self, login) -> None:
        """Из кабинета видно, где можно подать апелляцию сейчас."""
        items = login("14-17-10-11.5@example.test").get("/me/appealable").json()["items"]
        assert items and items[0]["entries"]


class TestProfileAndCoach:
    def test_sport_profile(self, login) -> None:
        """Спортивный профиль: организация, дисциплины, антидопинг."""
        profile = login("athlete@example.test").get("/me/sport-profile").json()
        assert profile["disciplines"] and profile["antidoping"]

    def test_antidoping_future_date_rejected(self, login) -> None:
        """Дата курса РУСАДА из будущего — 422."""
        response = login("athlete@example.test").post("/me/antidoping", json={"passed_on": "2099-01-01", "certificate_url": "https://rusada.ru/x"})
        assert response.status_code == 422

    def test_coach_links(self, login) -> None:
        """У тренера есть активные и приостановленная связь."""
        links = login("coach@example.test").get("/me/coach-links").json()["as_coach"]
        statuses = {link["status"] for link in links}
        assert {"active", "suspended"} <= statuses

    def test_coach_report_access(self, login, fed) -> None:
        """Отчёт по спортсмену доступен его тренеру и закрыт постороннему."""
        athletes = fed.get("/admin/registry/athletes", params={"q": "Ковалёв", "limit": 1}).json()["items"]
        user_id = athletes[0]["id"]
        assert login("coach@example.test").get(f"/people/{user_id}/report").json()["allowed"]
        assert login("organizer@example.test").get(f"/people/{user_id}/report.xlsx").status_code in (403, 404)

    def test_deadlines(self, login) -> None:
        """Сроки спортсмена: курс РУСАДА, даты по Оренбургу."""
        kinds = {item["kind"] for item in login("athlete@example.test").get("/me/deadlines").json()}
        assert "antidoping" in kinds

    def test_report_deadline_crud(self, fed) -> None:
        """Отчётный срок федерации: создать и удалить; пустое название — 422."""
        assert fed.post("/admin/report-deadlines", json={"title": " ", "due_on": "2027-01-20"}).status_code == 422
        created = fed.post("/admin/report-deadlines", json={"title": "Тестовый отчёт", "due_on": "2027-01-20"})
        assert created.status_code == 201, created.text
        assert fed.delete(f"/admin/report-deadlines/{created.json()['id']}").status_code == 204
