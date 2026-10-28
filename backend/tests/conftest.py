import importlib
import os
from collections.abc import Callable
from pathlib import Path

import httpx
import pytest

import infrastructure

ROOT = Path(next(iter(infrastructure.__path__)))
for path in sorted(ROOT.rglob("*.py")):
    importlib.import_module(".".join(("infrastructure", *path.relative_to(ROOT).with_suffix("").parts)))

API = os.environ.get("FSP_TEST_API", "http://localhost:8000/api/v1")
PASSWORD = "Demo1234"


def _alive() -> bool:
    """Проверяет, что стенд API запущен."""
    try:
        return httpx.get(f"{API}/health", timeout=5).status_code == 200
    except httpx.HTTPError:
        return False


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    """Интеграционные тесты пропускаются, если стенд не запущен."""
    if any("integration" in item.keywords for item in items) and not _alive():
        skip = pytest.mark.skip(reason=f"стенд API не отвечает: {API}")
        for item in items:
            if "integration" in item.keywords:
                item.add_marker(skip)


def pytest_configure(config: pytest.Config) -> None:
    """Регистрирует метку интеграционных тестов."""
    config.addinivalue_line("markers", "integration: тест обращается к запущенному стенду API")


def client(email: str | None = None) -> httpx.Client:
    """HTTP-клиент стенда; с почтой — вошедший, с CSRF-заголовком."""
    session = httpx.Client(base_url=API, timeout=90)
    if email:
        response = session.post("/auth/login", json={"email": email, "password": PASSWORD})
        assert response.status_code == 200, (email, response.text)
        session.headers["X-CSRF-Token"] = session.cookies.get("csrf_token") or ""
    return session


@pytest.fixture(scope="session")
def login() -> Callable[[str], httpx.Client]:
    """Вход под демо-аккаунтом; клиенты кэшируются на сессию тестов."""
    cache: dict[str, httpx.Client] = {}

    def make(email: str) -> httpx.Client:
        """Возвращает вошедший клиент для почты."""
        if email not in cache:
            cache[email] = client(email)
        return cache[email]

    return make


@pytest.fixture(scope="session")
def anon() -> httpx.Client:
    """Клиент без входа."""
    return client()


@pytest.fixture(scope="session")
def fed(login: Callable[[str], httpx.Client]) -> httpx.Client:
    """Сотрудник федерации."""
    return login("federation@example.test")


@pytest.fixture(scope="session")
def contests(fed: httpx.Client) -> dict[str, dict]:
    """Все соревнования демо-базы по названию."""
    return {item["title"]: item for item in fed.get("/admin/contests", params={"limit": 100}).json()["items"]}


def pdf_upload(session: httpx.Client) -> str:
    """Загружает минимальный PDF и возвращает id файла."""
    pdf = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"
    response = session.post("/files", files={"file": ("doc.pdf", pdf, "application/pdf")}, headers={"X-CSRF-Token": session.headers.get("X-CSRF-Token", "")})
    assert response.status_code == 201, response.text
    return response.json()["id"]
