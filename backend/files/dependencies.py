from typing import Annotated

from fastapi import Depends

from audit.dependencies import get_audit
from audit.domain.audit import Audit
from core.config import settings
from core.database import DbSession, UnitOfWork
from files.domain.files import Files
from files.repositories.pg_files import FileRepository
from files.repositories.s3_files import ObjectRepository

object_storage = ObjectRepository(settings)


def get_files(db: DbSession, audit: Annotated[Audit, Depends(get_audit)]) -> Files:
    return Files(UnitOfWork(db), FileRepository(db), object_storage, audit, settings)


FilesDep = Annotated[Files, Depends(get_files)]
