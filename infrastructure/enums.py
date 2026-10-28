from enum import StrEnum


class EmailStatus(StrEnum):
    NOT_REQUIRED = "not_required"
    PENDING = "pending"
    SENDING = "sending"
    SENT = "sent"
    FAILED = "failed"


class Channel(StrEnum):
    EMAIL = "email"
    TELEGRAM = "telegram"


class BotAdminLevel(StrEnum):
    MODERATOR = "moderator"
    ADMIN = "admin"
    OWNER = "owner"


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


class DocumentKind(StrEnum):
    CERTIFICATE = "certificate"
    DIPLOMA = "diploma"
    GRAMOTA = "gramota"
    THANKS = "thanks"
    JUDGE_THANKS = "judge_thanks"
    REFERENCE = "reference"


DOCUMENT_KIND_TITLES: dict[DocumentKind, str] = {
    DocumentKind.CERTIFICATE: "Сертификаты участников",
    DocumentKind.DIPLOMA: "Дипломы призёров",
    DocumentKind.GRAMOTA: "Грамоты",
    DocumentKind.THANKS: "Благодарности тренерам",
    DocumentKind.JUDGE_THANKS: "Благодарности судьям",
    DocumentKind.REFERENCE: "Справки об участии",
}


class PageVisibility(StrEnum):
    PUBLIC = "public"
    REGISTERED = "registered"
    PRIVATE = "private"


class WallRole(StrEnum):
    ATHLETE = "athlete"
    COACH = "coach"
    JUDGE = "judge"
    ORGANIZER = "organizer"


class QualificationKind(StrEnum):
    JUDGE_CATEGORY = "judge_category"
    RANK = "rank"


class QualificationStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"
    SUPERSEDED = "superseded"


QUALIFICATION_KIND_TITLES: dict[QualificationKind, str] = {
    QualificationKind.JUDGE_CATEGORY: "Судейская категория",
    QualificationKind.RANK: "Спортивный разряд",
}

QUALIFICATION_STATUS_TITLES: dict[QualificationStatus, str] = {
    QualificationStatus.PENDING: "На рассмотрении",
    QualificationStatus.APPROVED: "Присвоено",
    QualificationStatus.REJECTED: "Отказано",
    QualificationStatus.WITHDRAWN: "Отозвано",
    QualificationStatus.SUPERSEDED: "Заменено новым",
}


class ConsentStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


CONSENT_STATUS_TITLES: dict[ConsentStatus, str] = {
    ConsentStatus.PENDING: "На проверке",
    ConsentStatus.APPROVED: "Одобрено",
    ConsentStatus.REJECTED: "Отклонено",
}


class CodeforcesStatus(StrEnum):
    PENDING = "pending"
    OK = "ok"
    NOT_FOUND = "not_found"


class JudgeDocumentKind(StrEnum):
    NOTE = "note"
    ACT = "act"
    PROTOCOL = "protocol"
    OTHER = "other"


JUDGE_DOCUMENT_KIND_TITLES: dict[JudgeDocumentKind, str] = {
    JudgeDocumentKind.NOTE: "Судейская записка",
    JudgeDocumentKind.ACT: "Акт",
    JudgeDocumentKind.PROTOCOL: "Протокол судьи",
    JudgeDocumentKind.OTHER: "Другое",
}
