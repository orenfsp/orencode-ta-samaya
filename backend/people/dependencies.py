from typing import Annotated

from fastapi import Depends

from audit.dependencies import get_audit
from audit.domain.audit import Audit
from auth.dependencies import OptionalUserDep
from core.config import settings
from core.database import DbSession, UnitOfWork, session_factory
from files.dependencies import FilesDep
from infrastructure.enums import Role
from people.domain.codeforces import Codeforces, CodeforcesWatcher, Fetcher
from people.domain.people import People, Viewer
from people.domain.wall import Wall
from people.clients.codeforces import CodeforcesClient
from people.repositories.pg_codeforces import CodeforcesRepository
from people.repositories.pg_people import PersonRepository
from people.repositories.pg_wall import WallRepository


def get_people(db: DbSession, files: FilesDep, audit: Annotated[Audit, Depends(get_audit)]) -> People:
    """Собирает сервис страниц пользователей с нужными зависимостями."""
    return People(uow=UnitOfWork(db), people=PersonRepository(db), files=files, audit=audit)


def get_wall(db: DbSession, files: FilesDep, audit: Annotated[Audit, Depends(get_audit)]) -> Wall:
    """Собирает сервис стены с нужными зависимостями."""
    return Wall(uow=UnitOfWork(db), wall=WallRepository(db), people=PersonRepository(db), files=files, audit=audit)


def fetcher() -> Fetcher:
    """Создаёт клиент получения данных с Codeforces по настройкам приложения."""
    return Fetcher(CodeforcesClient(settings.codeforces_api_url), settings.codeforces_pause_seconds)


def get_codeforces(db: DbSession, audit: Annotated[Audit, Depends(get_audit)]) -> Codeforces:
    """Собирает сервис привязки хэндлов Codeforces с нужными зависимостями."""
    return Codeforces(UnitOfWork(db), CodeforcesRepository(db), fetcher(), audit)


def codeforces_watcher() -> CodeforcesWatcher:
    """Создаёт фоновый сторож, периодически обновляющий рейтинги Codeforces."""
    return CodeforcesWatcher(session_factory, fetcher, settings)


def get_viewer(user: OptionalUserDep) -> Viewer:
    """Строит описание зрителя страницы по текущему пользователю, если он есть."""
    if user is None:
        return Viewer(None, False)
    return Viewer(user.id, Role.FEDERATION in user.roles)


PeopleDep = Annotated[People, Depends(get_people)]
WallDep = Annotated[Wall, Depends(get_wall)]
ViewerDep = Annotated[Viewer, Depends(get_viewer)]
CodeforcesDep = Annotated[Codeforces, Depends(get_codeforces)]
