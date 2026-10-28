from typing import Annotated

from fastapi import Depends

from core.database import DbSession
from documents.repositories.pg_documents import DocumentRepository
from qualifications.repositories.pg_qualifications import QualificationRepository
from ratings.dependencies import RatingsDep
from reports.domain.person_report import PersonReports
from reports.repositories.pg_reports import ReportRepository
from squads.repositories.pg_squads import SquadRepository


def get_person_reports(db: DbSession, ratings: RatingsDep) -> PersonReports:
    """Собирает сервис отчётов по человеку с нужными зависимостями."""
    return PersonReports(ReportRepository(db), QualificationRepository(db), DocumentRepository(db),
                         SquadRepository(db), ratings)


PersonReportsDep = Annotated[PersonReports, Depends(get_person_reports)]
