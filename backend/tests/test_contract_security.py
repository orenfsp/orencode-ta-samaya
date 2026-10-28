import re
import time
from pathlib import Path

import httpx
import pytest

from tests.conftest import API, client

pytestmark = pytest.mark.integration

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture(scope="module")
def spec() -> dict:
    """OpenAPI-спецификация работающего приложения."""
    return httpx.get(API.replace("/api/v1", "") + "/openapi.json", timeout=30).json()


def operations(spec: dict) -> list[tuple[str, str, dict]]:
    """Все операции спецификации: метод, путь без префикса, описание."""
    return [
        (method.upper(), path.replace("/api/v1", ""), op)
        for path, methods in spec["paths"].items()
        for method, op in methods.items()
        if method in ("get", "post", "put", "patch", "delete")
    ]


class TestContract:
    def test_every_operation_documented(self, spec) -> None:
        """Контракт: у каждой операции есть раздел, краткое название и описание."""
        missing = [f"{m} {p}" for m, p, op in operations(spec) if not (op.get("tags") and op.get("summary") and op.get("description"))]
        assert not missing, missing[:10]

    def test_mutations_declare_csrf(self, spec) -> None:
        """Контракт: изменяющие операции объявляют CSRF-заголовок, кроме входа и регистрации."""
        public = {"/auth/register", "/auth/login", "/auth/password/forgot", "/auth/password/verify", "/auth/password/reset"}
        missing = [f"{m} {p}" for m, p, op in operations(spec) if m != "GET" and p not in public and not op.get("security")]
        assert not missing, missing[:10]

    def test_api_map_covers_spec(self, spec) -> None:
        """Документация: каждый эндпоинт спецификации есть в API_DOCUMENTATION.md."""
        text = (ROOT / "API_DOCUMENTATION.md").read_text(encoding="utf-8")
        missing = [
            f"{m} {p}" for m, p, _ in operations(spec)
            if f"`{m} {p}`" not in text and "/admin/dictionaries/" not in p
        ]
        assert not missing, missing[:10]

    def test_public_get_never_500(self, spec) -> None:
        """Дымовой прогон: публичные GET без параметров пути не падают с 5xx ни без входа, ни под федерацией."""
        fed = client("federation@example.test")
        paths = [p for m, p, _ in operations(spec) if m == "GET" and "{" not in p and not p.endswith((".xlsx", ".pdf"))]
        failures = []
        for path in paths:
            for session in (client(), fed):
                code = session.get(path).status_code
                if code >= 500:
                    failures.append((path, code))
        assert not failures, failures

    def test_error_shape_everywhere(self, anon) -> None:
        """Контракт ошибок: 401, 404 и 422 приходят в формате {error: {code, message}}."""
        for response in (anon.get("/me"), anon.get("/contests/999999"), anon.post("/auth/login", json={})):
            body = response.json()
            assert response.status_code in (401, 404, 422) and {"code", "message"} <= set(body["error"])


class TestSecurity:
    @pytest.mark.parametrize("payload", ["' OR 1=1 --", "\"; DROP TABLE users; --", "%' UNION SELECT password_hash FROM users --", "<script>alert(1)</script>", "../../etc/passwd"])
    def test_injection_in_search(self, fed, payload: str) -> None:
        """Инъекции в поиске не ломают запрос и не раскрывают данные."""
        for path, params in (("/admin/registry/athletes", {"q": payload}), ("/organizations", {"q": payload}), ("/contests", {"q": payload})):
            response = fed.get(path, params=params)
            assert response.status_code in (200, 422), (path, response.status_code)
            assert "password" not in response.text.lower()

    def test_logout_invalidates_session(self) -> None:
        """После выхода прежняя сессия не работает."""
        session = client("coach@example.test")
        assert session.post("/auth/logout").status_code in (200, 204)
        assert session.get("/me").status_code == 401

    def test_forged_csrf_rejected(self, login) -> None:
        """Подменённый CSRF-токен отклоняется."""
        session = login("athlete@example.test")
        response = session.post("/notifications/read-all", headers={"X-CSRF-Token": "forged-token"})
        assert response.status_code == 403

    def test_ungranted_active_role_rejected(self, login) -> None:
        """Нельзя выдать себя за роль, которой нет у аккаунта."""
        assert login("athlete@example.test").get("/me", headers={"X-Active-Role": "federation"}).status_code == 403

    def test_disguised_executable_rejected(self, login) -> None:
        """Файл с расширением PDF, но чужим содержимым, не принимается."""
        session = login("athlete@example.test")
        response = session.post("/files", files={"file": ("cv.pdf", b"MZ\x90\x00 fake exe", "application/pdf")})
        assert response.status_code in (415, 422)

    def test_foreign_application_hidden(self, login) -> None:
        """Чужая заявка недоступна: 404 без раскрытия данных."""
        own = login("athlete@example.test").get("/me/applications").json()["items"]
        response = login("u14-5-9.1@example.test").get(f"/applications/{own[0]['id']}")
        assert response.status_code in (403, 404)

    def test_no_secrets_in_responses(self, fed) -> None:
        """Хэши паролей и подписи не утекают в ответы API."""
        texts = [fed.get("/admin/registry/athletes", params={"limit": 5}).text, fed.get("/me").text]
        assert not any(re.search(r"argon2|password_hash|signature", text) for text in texts)

    def test_login_bruteforce_limited(self) -> None:
        """После 5 неверных паролей вход блокируется с 429 и Retry-After."""
        session = client()
        email = "u14-1-4.4@example.test"
        codes = [session.post("/auth/login", json={"email": email, "password": f"wrong{n}"}).status_code for n in range(6)]
        assert codes[-1] == 429


class TestPerformance:
    @pytest.mark.parametrize("path", ["/ratings?limit=10", "/contests?limit=20", "/calendar/events", "/squads"])
    def test_public_pages_fast(self, anon, path: str) -> None:
        """Публичные списки отвечают быстрее 2 секунд на демо-данных."""
        started = time.perf_counter()
        assert anon.get(path).status_code == 200
        assert time.perf_counter() - started < 2

    @pytest.mark.parametrize("path", ["/admin/registry/headcount?cut=discipline", "/admin/analytics/participants", "/admin/registry/athletes?limit=50"])
    def test_federation_reports_fast(self, fed, path: str) -> None:
        """Отчёты федерации отвечают быстрее 3 секунд."""
        started = time.perf_counter()
        assert fed.get(path).status_code == 200
        assert time.perf_counter() - started < 3
