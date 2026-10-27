from pydantic import BaseModel, ConfigDict


class ParticipantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    last_name: str
    first_name: str
    middle_name: str | None


class EntryOut(BaseModel):
    team_name: str | None
    members: list[ParticipantOut]


class ParticipantList(BaseModel):
    items: list[EntryOut]
    total_people: int
