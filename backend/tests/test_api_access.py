import pytest

pytestmark = pytest.mark.integration


class TestAuth:
    def test_login_and_me(self, login) -> None:
        """Вход ставит сессию, /me возвращает аккаунт с ролями."""
        me = login("federation@example.test").get("/me").json()
        assert me["email"] == "federation@example.test"
        assert any(role["role"] == "federation" and role["status"] == "verified" for role in me["roles"])

    def test_wrong_password(self, anon) -> None:
        """Неверный пароль — 401 invalid_credentials."""
        response = anon.post("/auth/login", json={"email": "coach@example.test", "password": "wrong-password"})
        assert response.status_code == 401 and response.json()["error"]["code"] == "invalid_credentials"

    def test_me_requires_session(self, anon) -> None:
        """Без сессии /me — 401."""
        assert anon.get("/me").status_code == 401

    def test_csrf_required_for_mutations(self, login) -> None:
        """Изменяющий запрос без CSRF-заголовка — 403 csrf_failed."""
        session = login("athlete@example.test")
        response = session.post("/notifications/read-all", headers={"X-CSRF-Token": ""})
        assert response.status_code == 403 and response.json()["error"]["code"] == "csrf_failed"

    def test_register_validation(self, anon) -> None:
        """Регистрация с плохой почтой и коротким паролем — 422 с ошибками полей."""
        response = anon.post("/auth/register", json={"email": "not-an-email", "password": "1"})
        assert response.status_code == 422 and response.json()["error"]["fields"]

    def test_error_format(self, anon) -> None:
        """Ошибки приходят в едином формате {error: {code, message, fields}}."""
        body = anon.get("/contests/999999").json()
        assert set(body["error"]) >= {"code", "message"}


class TestRoleAccess:
    @pytest.mark.parametrize("path", ["/admin/contests", "/admin/disputes", "/admin/registry/athletes", "/admin/audit", "/admin/qualifications", "/admin/analytics/participants"])
    def test_admin_closed_for_athlete(self, login, path: str) -> None:
        """Спортсмену разделы федерации закрыты."""
        assert login("athlete@example.test").get(path).status_code == 403

    @pytest.mark.parametrize("path", ["/admin/contests", "/admin/registry/athletes"])
    def test_admin_requires_session(self, anon, path: str) -> None:
        """Без входа разделы федерации — 401."""
        assert anon.get(path).status_code == 401

    def test_organizer_closed_for_coach(self, login) -> None:
        """Тренеру кабинет организатора закрыт."""
        assert login("coach@example.test").get("/organizer/contests").status_code == 403

    def test_pending_role_has_no_access(self, login) -> None:
        """Неподтверждённый организатор не получает кабинет организатора."""
        assert login("organizer.pending@example.test").get("/organizer/contests").status_code == 403

    def test_private_file_hidden(self, login, fed) -> None:
        """Приватный файл чужого человека скрыт как несуществующий."""
        from tests.conftest import pdf_upload

        file_id = pdf_upload(login("coach@example.test"))
        assert login("athlete@example.test").get(f"/files/{file_id}", follow_redirects=False).status_code == 404
        assert fed.get(f"/files/{file_id}", follow_redirects=False).status_code in (302, 307)

    def test_minor_masked_for_stranger(self, anon, fed) -> None:
        """У несовершеннолетнего посторонний не видит дату рождения."""
        athletes = fed.get("/admin/registry/athletes", params={"q": "Белова", "limit": 5}).json()["items"]
        person = anon.get(f"/people/{athletes[0]['id']}").json()
        assert not person.get("birth_date")
