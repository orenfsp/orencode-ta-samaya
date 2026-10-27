from typing import Annotated

from fastapi import Depends

from auth.dependencies import AuditDep
from contests.dependencies import ContestDep
from core.database import DbSession, UnitOfWork
from events.domain.calendar import Calendar
from events.repositories.pg_calendar import CalendarRepository


def get_calendar(db: DbSession, contests: ContestDep, audit: AuditDep) -> Calendar:
    return Calendar(CalendarRepository(db), contests, UnitOfWork(db), audit)


CalendarDep = Annotated[Calendar, Depends(get_calendar)]
