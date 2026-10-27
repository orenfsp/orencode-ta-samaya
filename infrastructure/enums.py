from enum import StrEnum


class Role(StrEnum):
    FEDERATION = "federation"
    ORGANIZER = "organizer"
    ATHLETE = "athlete"
    COACH = "coach"
    JUDGE = "judge"


class RoleStatus(StrEnum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"


class RankKind(StrEnum):
    SPORT = "Спортивный разряд"
    YOUTH = "Юношеский разряд"
    TITLE = "Спортивное звание"


class ContestStatus(StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"
    REGISTRATION_OPEN = "registration_open"
    REGISTRATION_CLOSED = "registration_closed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ARCHIVED = "archived"
    CANCELLED = "cancelled"


class VerificationStatus(StrEnum):
    NOT_REQUESTED = "not_requested"
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"


class ParticipationType(StrEnum):
    INDIVIDUAL = "individual"
    TEAM = "team"


class ApplicationStatus(StrEnum):
    FORMING = "forming"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


class ApplicationCreator(StrEnum):
    ATHLETE = "athlete"
    COACH = "coach"


class MemberConfirmation(StrEnum):
    INVITED = "invited"
    CONFIRMED = "confirmed"
    DECLINED = "declined"


CONTEST_STATUS_TITLES: dict[ContestStatus, str] = {
    ContestStatus.DRAFT: "Черновик",
    ContestStatus.PUBLISHED: "Опубликовано",
    ContestStatus.REGISTRATION_OPEN: "Регистрация открыта",
    ContestStatus.REGISTRATION_CLOSED: "Регистрация закрыта",
    ContestStatus.IN_PROGRESS: "Идёт",
    ContestStatus.COMPLETED: "Завершено",
    ContestStatus.ARCHIVED: "В архиве",
    ContestStatus.CANCELLED: "Отменено",
}

VERIFICATION_STATUS_TITLES: dict[VerificationStatus, str] = {
    VerificationStatus.NOT_REQUESTED: "Не запрошена",
    VerificationStatus.PENDING: "На проверке",
    VerificationStatus.VERIFIED: "Верифицировано федерацией",
    VerificationStatus.REJECTED: "Отказано",
}

PARTICIPATION_TYPE_TITLES: dict[ParticipationType, str] = {
    ParticipationType.INDIVIDUAL: "Личное",
    ParticipationType.TEAM: "Командное",
}

APPLICATION_STATUS_TITLES: dict[ApplicationStatus, str] = {
    ApplicationStatus.FORMING: "Собирается состав",
    ApplicationStatus.SUBMITTED: "На рассмотрении",
    ApplicationStatus.APPROVED: "Одобрена",
    ApplicationStatus.REJECTED: "Отклонена",
    ApplicationStatus.WITHDRAWN: "Отозвана",
}

MEMBER_CONFIRMATION_TITLES: dict[MemberConfirmation, str] = {
    MemberConfirmation.INVITED: "Приглашён",
    MemberConfirmation.CONFIRMED: "Подтвердил",
    MemberConfirmation.DECLINED: "Отказался",
}
