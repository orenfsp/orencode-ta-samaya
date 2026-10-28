import pytest

pytestmark = pytest.mark.integration


class TestCatalog:
    def test_public_catalog_and_card(self, anon) -> None:
        """Каталог без входа отдаёт опубликованные соревнования, карточка открывается."""
        page = anon.get("/contests", params={"limit": 5}).json()
        assert page["total"] > 0 and page["items"]
        card = anon.get(f"/contests/{page['items'][0]['id']}").json()
        assert card["title"] and card["discipline"]["name"]

    def test_unknown_contest_404(self, anon) -> None:
        """Несуществующее соревнование — 404."""
        assert anon.get("/contests/999999").status_code == 404

    def test_dictionaries_six_plus_disciplines(self, anon) -> None:
        """В справочнике есть все шесть дисциплин кейса."""
        names = {item["name"] for item in anon.get("/dictionaries/disciplines").json() if not item["is_archived"]}
        assert len(names) >= 6 and "Квизы" in names


class TestApplications:
    def test_available_contests_explain_problems(self, login) -> None:
        """Список «куда записаться» объясняет, почему нельзя."""
        items = login("athlete.third@example.test").get("/me/available-contests", params={"as": "athlete"}).json()["items"]
        assert items and all("problems" in item for item in items)
        assert any("отстранён" in " ".join(item["problems"]) for item in items)

    def test_suspended_cannot_apply(self, login, contests) -> None:
        """Отстранённый спортсмен не может подать заявку."""
        session = login("athlete.third@example.test")
        open_contest = next(item for item in contests.values() if item["status"] == "registration_open" and item["participation_type"] == "individual")
        response = session.post(f"/contests/{open_contest['id']}/applications", json={"as": "athlete", "member_ids": [session.get("/me").json()["id"]]})
        assert response.status_code == 422 and "отстранён" in response.text

    def test_registration_closed_contest(self, login, contests) -> None:
        """На завершённое соревнование подать заявку нельзя."""
        session = login("athlete@example.test")
        done = next(item for item in contests.values() if item["status"] == "completed")
        response = session.post(f"/contests/{done['id']}/applications", json={"as": "athlete", "member_ids": [session.get("/me").json()["id"]]})
        assert response.status_code in (409, 422)

    def test_participants_public(self, anon, contests) -> None:
        """Список одобренных участников публичный."""
        contest = contests["Чемпионат Оренбургской области по алгоритмическому программированию"]
        assert anon.get(f"/contests/{contest['id']}/participants").json()["items"]


class TestResultsAndDocuments:
    def test_results_public_with_disqualification(self, anon, contests) -> None:
        """Места чемпионата публичны, дисквалификация — место null."""
        contest = contests["Чемпионат Оренбургской области по алгоритмическому программированию"]
        items = anon.get(f"/contests/{contest['id']}/results").json()["items"]
        assert items[0]["place"] == 1 and any(item["place"] is None for item in items)

    def test_protocol_xlsx(self, fed, contests) -> None:
        """Протокол выгружается в xlsx."""
        contest = contests["Чемпионат Оренбургской области по алгоритмическому программированию"]
        response = fed.get(f"/admin/contests/{contest['id']}/results/protocol.xlsx")
        assert response.status_code == 200 and response.content[:2] == b"PK"

    def test_places_must_be_consecutive(self, fed, contests) -> None:
        """Места с пропуском — 422, протокол не меняется."""
        contest = contests["Командный CTF «Оренбургский рубеж»"]
        entries = fed.get(f"/admin/contests/{contest['id']}/results").json()["items"]
        items = [{"application_id": entry["application_id"], "place": index * 2 + 1} for index, entry in enumerate(entries)]
        assert fed.put(f"/admin/contests/{contest['id']}/results", json={"items": items}).status_code == 422

    def test_document_qr_verify(self, login, anon) -> None:
        """Документ проверяется по QR без входа, поддельный токен — 404."""
        documents = login("athlete@example.test").get("/me/documents").json()["items"]
        assert documents
        assert anon.get(f"/documents/{documents[0]['token']}").status_code == 200
        assert anon.get("/documents/fake-token-000").status_code == 404

    def test_readiness_checklist(self, fed, contests) -> None:
        """Чек-лист готовности соревнования из 11 пунктов."""
        contest = contests["Чемпионат Оренбургской области по алгоритмическому программированию"]
        assert len(fed.get(f"/contests/{contest['id']}/readiness").json()["items"]) == 11
