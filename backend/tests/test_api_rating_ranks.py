import pytest

pytestmark = pytest.mark.integration

ALG = "Алгоритмическое программирование"


def sokolov(anon, params: dict | None = None) -> list[dict]:
    """Строки Соколова во всех рейтингах алгоритмики."""
    discipline = next(item["id"] for item in anon.get("/dictionaries/disciplines").json() if item["name"] == ALG)
    boards = anon.get("/ratings", params={"discipline_id": discipline, "limit": 50, **(params or {})}).json()["items"]
    return [line for board in boards for line in board["items"] if line["athlete"]["full_name"].startswith("Соколов")]


class TestRating:
    def test_case_example(self, anon) -> None:
        """Пример кейса на демо-данных: 45 + 40 + 0 = 85 × 1,2 = 102."""
        lines = sokolov(anon)
        assert lines and all(line["points"] == 102 and line["explain"] == "45 + 40 + 0 = 85 × 1,2 = 102" for line in lines)

    def test_min_rank_filter(self, anon) -> None:
        """Фильтр «разряд не ниже» оставляет только разрядников."""
        ranks = {item["name"]: item["id"] for item in anon.get("/dictionaries/rank_types").json()}
        assert sokolov(anon, {"min_rank_id": ranks["Второй спортивный разряд"]})
        assert not sokolov(anon, {"min_rank_id": ranks["Мастер спорта России"]})

    def test_suspended_excluded_with_reason(self, login, anon) -> None:
        """Отстранённого нет в рейтинге, причина названа первой."""
        status = login("athlete.third@example.test").get("/ratings/me").json()
        assert not status["in_rating"] and status["reasons"][0]["code"] == "suspended"
        boards = anon.get("/ratings", params={"limit": 50}).json()["items"]
        assert not any(line["athlete"]["full_name"].startswith("Гусев") for board in boards for line in board["items"])

    def test_rules_validation_and_access(self, fed, login) -> None:
        """Правила рейтинга меняет только федерация и в допустимых границах."""
        body = {"stability_factor": 1.2, "podium_place": 3, "podium_count": 2, "season": "rolling"}
        assert login("athlete@example.test").put("/admin/ratings/settings", json=body).status_code == 403
        assert fed.put("/admin/ratings/settings", json={**body, "stability_factor": 5}).status_code == 422

    def test_rules_change_recalculates(self, fed, anon) -> None:
        """Коэффициент 1,5 даёт 128, после возврата снова 102."""
        body = {"stability_factor": 1.5, "podium_place": 3, "podium_count": 2, "season": "rolling"}
        try:
            assert fed.put("/admin/ratings/settings", json=body).status_code == 200
            assert sokolov(anon)[0]["points"] == 128
        finally:
            fed.put("/admin/ratings/settings", json={**body, "stability_factor": 1.2})
        assert sokolov(anon)[0]["points"] == 102


class TestQualifications:
    def test_seeded_rank_qr_valid(self, login, anon) -> None:
        """Демо-разряд проверяется по QR: подпись верна, приказ указан."""
        items = login("athlete@example.test").get("/me/qualifications").json()["items"]
        current = next(item for item in items if item["status"] == "approved" and item["kind"] == "rank")
        verified = anon.get(f"/verify/qualifications/{current['token']}").json()
        assert verified["valid"] and verified["order_number"]

    def test_fake_qr_404(self, anon) -> None:
        """Поддельный токен разряда — 404."""
        assert anon.get("/verify/qualifications/0000000000000000").status_code == 404

    def test_approve_requires_order(self, fed) -> None:
        """Присвоение без номера и даты приказа — 422."""
        data = fed.get("/admin/qualifications", params={"kind": "rank"}).json()
        pending = data["items"] if isinstance(data, dict) else data
        assert pending
        assert fed.post(f"/admin/qualifications/{pending[0]['id']}/approve", json={}).status_code == 422

    def test_second_pending_rejected(self, login) -> None:
        """Вторая заявка на разряд, пока первая в очереди, — 409 already_pending."""
        from tests.conftest import pdf_upload

        session = login("athlete@example.test")
        ranks = {item["name"]: item["id"] for item in session.get("/dictionaries/rank_types").json()}
        response = session.post("/qualifications", json={"kind": "rank", "item_id": ranks["Кандидат в мастера спорта"], "document_file_id": pdf_upload(session)})
        assert response.status_code == 409

    def test_personal_path(self, login) -> None:
        """Личный путь показывает текущий разряд и следующую ступень."""
        path = login("athlete@example.test").get("/me/path").json()
        assert path["current"] and path["next"]

    def test_evsk_candidates(self, fed) -> None:
        """Федерация видит претендентов на разряд по протоколам."""
        assert isinstance(fed.get("/admin/evsk/candidates").json(), list)


class TestRegistry:
    def test_headcount_two_years(self, fed) -> None:
        """Численность занимающихся — минимум за два года."""
        report = fed.get("/admin/registry/headcount", params={"cut": "discipline"}).json()
        assert len(report["years"]) >= 2 and report["rows"]

    def test_headcount_xlsx(self, fed) -> None:
        """Отчёт о численности выгружается книгой xlsx."""
        response = fed.get("/admin/registry/headcount.xlsx")
        assert response.status_code == 200 and response.content[:2] == b"PK"

    def test_registry_filters(self, fed) -> None:
        """Реестр спортсменов фильтруется по организации: список сужается, xlsx повторяет фильтр."""
        everyone = fed.get("/admin/registry/athletes", params={"limit": 1}).json()["total"]
        filtered = fed.get("/admin/registry/athletes", params={"organization_id": 1, "limit": 1}).json()["total"]
        assert 0 < filtered < everyone
        assert fed.get("/admin/registry/athletes.xlsx", params={"organization_id": 1}).content[:2] == b"PK"
