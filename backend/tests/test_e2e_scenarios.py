from datetime import UTC, date, datetime, timedelta

import pytest

from tests.conftest import client, pdf_upload

pytestmark = pytest.mark.integration


def dictionary(session, key: str, name: str) -> int:
    """Id записи справочника по названию."""
    return next(item["id"] for item in session.get(f"/dictionaries/{key}").json() if item["name"] == name)


@pytest.fixture(scope="module")
def contest(fed) -> dict:
    """Сквозной сценарий С2 → С3 → С5: соревнование федерации от создания до мест и документов."""
    now = datetime.now(UTC)
    body = {
        "title": f"Сквозной тест {now:%H%M%S%f}",
        "discipline_id": dictionary(fed, "disciplines", "Программирование систем искусственного интеллекта"),
        "contest_type_id": dictionary(fed, "contest_types", "Первенство"),
        "contest_level_id": dictionary(fed, "contest_levels", "Региональное"),
        "contest_format_id": dictionary(fed, "contest_formats", "Онлайн"),
        "participation_type": "individual",
        "starts_on": (date.today() + timedelta(days=10)).isoformat(),
        "ends_on": (date.today() + timedelta(days=10)).isoformat(),
        "registration_opens_at": (now - timedelta(days=1)).isoformat(),
        "registration_closes_at": (now + timedelta(days=5)).isoformat(),
        "calendar_plan": "regional",
        "calendar_plan_number": "КП-2026/999",
        "regulations_file_id": pdf_upload(fed),
        "rating_points": [{"place": 1, "points": 40}, {"place": 2, "points": 30}, {"place": 3, "points": 20}],
    }
    created = fed.post("/admin/contests", json=body)
    assert created.status_code == 201, created.text
    return created.json()


class TestCompetitionLifecycle:
    def test_c2_created_with_dictionary_fields(self, contest) -> None:
        """С2: соревнование с дисциплиной, типом, уровнем, форматом, календарным планом и положением."""
        assert contest["status"] == "draft" and contest["calendar_plan"] == "regional" and contest["regulations"]

    def test_c2_publish_and_open(self, fed, anon, contest) -> None:
        """С2: публикация и открытие приёма заявок, соревнование видно в каталоге."""
        assert fed.post(f"/admin/contests/{contest['id']}/publish").status_code == 200
        assert fed.post(f"/admin/contests/{contest['id']}/open-registration").status_code == 200
        assert anon.get(f"/contests/{contest['id']}").json()["status"] == "registration_open"

    def test_c3_apply_and_moderate(self, fed, login, contest) -> None:
        """С3: спортсмен подаёт заявку, федерация одобряет; повторная заявка не создаётся."""
        athlete = login("athlete@example.test")
        me = athlete.get("/me").json()["id"]
        created = athlete.post(f"/contests/{contest['id']}/applications", json={"as": "athlete", "member_ids": [me]})
        assert created.status_code == 201, created.text
        application = created.json()
        assert application["status"] == "submitted"
        again = athlete.post(f"/contests/{contest['id']}/applications", json={"as": "athlete", "member_ids": [me]})
        assert again.status_code in (409, 422)
        approved = fed.post(f"/admin/applications/{application['id']}/approve")
        assert approved.status_code == 200 and approved.json()["status"] == "approved"

    def test_c3_age_group_check(self, fed, login, contest) -> None:
        """С3: допуск по возрасту — спортсмен вне возрастных групп получает отказ с причиной."""
        group = dictionary(fed, "age_groups", "До 14 лет")
        assert fed.patch(f"/admin/contests/{contest['id']}", json={"age_group_ids": [group]}).status_code == 200
        athlete = login("athlete.second@example.test")
        response = athlete.post(f"/contests/{contest['id']}/applications", json={"as": "athlete", "member_ids": [athlete.get("/me").json()["id"]]})
        assert response.status_code == 422 and "возраст" in response.text
        assert fed.patch(f"/admin/contests/{contest['id']}", json={"age_group_ids": []}).status_code == 200

    def test_c5_results_protocol_history(self, fed, login, contest) -> None:
        """С5: федерация вносит места; протокол строится из одобренных заявок; место в истории спортсмена."""
        fed.post(f"/admin/contests/{contest['id']}/close-registration")
        assert fed.post(f"/admin/contests/{contest['id']}/start").status_code == 200
        form = fed.get(f"/admin/contests/{contest['id']}/results").json()
        assert len(form["items"]) == 1
        saved = fed.put(f"/admin/contests/{contest['id']}/results", json={"items": [{"application_id": form["items"][0]["application_id"], "place": 1}]})
        assert saved.status_code in (200, 204), saved.text
        assert fed.get(f"/admin/contests/{contest['id']}/results/protocol.xlsx").content[:2] == b"PK"
        athlete = login("athlete@example.test")
        wall = athlete.get(f"/people/{athlete.get('/me').json()['id']}/wall", params={"role": "athlete"}).json()
        assert any(item["contest"]["id"] == contest["id"] for item in wall["items"])


class TestCoachJudgeRank:
    def test_c4_coach_link_confirmed(self, login) -> None:
        """С4: тренер привязывает спортсмена по дисциплине, спортсмен подтверждает."""
        coach = login("coach.judge@example.test")
        athlete = login("athlete@example.test")
        link = next(item for item in athlete.get("/me/coach-links").json()["as_athlete"] if item["status"] == "requested")
        accepted = athlete.post(f"/coach-links/{link['id']}/accept", json={})
        assert accepted.status_code == 200 and accepted.json()["status"] == "active"
        assert any(item["id"] == link["id"] and item["status"] == "active" for item in coach.get("/me/coach-links").json()["as_coach"])

    def test_c6_panel_and_judge_cabinet(self, login, contests) -> None:
        """С6: коллегия назначена, судья видит свои назначения и срок категории."""
        judge = login("judge@example.test")
        assert judge.get("/me/judge-assignments").json()
        category = next(item for item in judge.get("/me/qualifications").json()["items"] if item["kind"] == "judge_category")
        assert category["valid_until"]

    def test_c7_rank_with_result_and_order(self, fed, login) -> None:
        """С7: заявка на разряд с местом из протокола, присвоение с приказом, проверка по QR."""
        athlete = login("athlete.second@example.test")
        results = athlete.get("/me/qualification-results").json()
        ranks = {item["name"]: item["id"] for item in athlete.get("/dictionaries/rank_types").json()}
        created = athlete.post("/qualifications", json={
            "kind": "rank", "item_id": ranks["Третий спортивный разряд"], "document_file_id": pdf_upload(athlete),
            "contest_result_id": results[0]["id"],
        })
        assert created.status_code == 201, created.text
        approved = fed.post(f"/admin/qualifications/{created.json()['id']}/approve", json={"order_number": "99-р", "order_date": date.today().isoformat()})
        assert approved.status_code == 200, approved.text
        verified = client().get(f"/verify/qualifications/{approved.json()['token']}").json()
        assert verified["valid"] and verified["order_number"] == "99-р"


class TestSquadAndActiveRole:
    def test_c9_manual_exclusion_and_order_draft(self, fed, anon) -> None:
        """С9: исключённого заменяет следующий по рейтингу; PDF списка сборной и проекта приказа."""
        discipline = dictionary(anon, "disciplines", "Алгоритмическое программирование")
        group = dictionary(anon, "age_groups", "18 лет и старше")
        params = {"discipline_id": discipline, "group_kind": "age", "group_id": group, "main_size": 2, "reserve_size": 1}
        base = fed.get("/admin/squads/candidates", params=params).json()
        first = base["main"][0]["athlete_id"]
        changed = fed.get("/admin/squads/candidates", params={**params, "exclude_ids": [first]}).json()
        assert first not in {item["athlete_id"] for item in changed["main"] + changed["reserve"]}
        assert changed["excluded"][0]["athlete_id"] == first
        pdf = fed.get("/admin/squads/order-draft.pdf", params={**params, "exclude_ids": [first]})
        assert pdf.status_code == 200 and pdf.content[:4] == b"%PDF"

    def test_c1_active_role_narrows_rights(self, login) -> None:
        """С1: права проверяются по активной роли кабинета: в роли спортсмена тренерские операции закрыты."""
        both = login("athlete.coach@example.test")
        target = login("pupil2@example.test").get("/me").json()["id"]
        body = {"athlete_id": target, "discipline_id": 1}
        as_athlete = both.post("/coach-links", json=body, headers={"X-Active-Role": "athlete"})
        assert as_athlete.status_code == 403
        as_coach = both.post("/coach-links", json=body, headers={"X-Active-Role": "coach"})
        assert as_coach.status_code != 403, as_coach.text
        assert both.get("/me", headers={"X-Active-Role": "federation"}).status_code == 403


class TestExpiryWarnings:
    def test_c7_federation_warned_about_expiring_category(self, fed, login) -> None:
        """С7: об истекающем сроке предупреждается не только владелец, но и федерация."""
        owner = login("judge@example.test").get("/notifications", params={"limit": 50}).json()["items"]
        assert any(item["type"] == "qualification.expiring" for item in owner)
        federation = fed.get("/notifications", params={"limit": 100}).json()["items"]
        assert any(item["type"] == "qualification.expiring" and "Орлов" in item["text"] for item in federation)
