from uuid import UUID

from pydantic import BaseModel

from infrastructure.enums import ParticipationType


class AthleteOut(BaseModel):
    id: UUID
    full_name: str


class PlaceOut(BaseModel):
    place: int | None
    points: int
    team_name: str | None
    athletes: list[AthleteOut]


class ResultsOut(BaseModel):
    participation_type: ParticipationType
    is_verified: bool
    items: list[PlaceOut]
