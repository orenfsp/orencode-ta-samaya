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
    JUDGE_PANEL = "judge_panel"


DOCUMENT_KIND_TITLES: dict[DocumentKind, str] = {
    DocumentKind.CERTIFICATE: "Сертификаты участников",
    DocumentKind.DIPLOMA: "Дипломы призёров",
    DocumentKind.GRAMOTA: "Грамоты",
    DocumentKind.THANKS: "Благодарности тренерам",
    DocumentKind.JUDGE_THANKS: "Благодарности судьям",
    DocumentKind.REFERENCE: "Справки об участии",
    DocumentKind.JUDGE_PANEL: "Справка о составе судейской коллегии",
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


class TrainingStage(StrEnum):
    INITIAL = "initial"
    TRAINING = "training"
    IMPROVEMENT = "improvement"
    HIGHEST = "highest"


TRAINING_STAGE_TITLES: dict[TrainingStage, str] = {
    TrainingStage.INITIAL: "Начальная подготовка",
    TrainingStage.TRAINING: "Учебно-тренировочный этап",
    TrainingStage.IMPROVEMENT: "Совершенствование спортивного мастерства",
    TrainingStage.HIGHEST: "Высшее спортивное мастерство",
}


class Sex(StrEnum):
    MALE = "male"
    FEMALE = "female"


class CoachLinkStatus(StrEnum):
    REQUESTED = "requested"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    ENDED = "ended"
    DECLINED = "declined"


COACH_LINK_STATUS_TITLES: dict[CoachLinkStatus, str] = {
    CoachLinkStatus.REQUESTED: "Ждёт подтверждения",
    CoachLinkStatus.ACTIVE: "Активна",
    CoachLinkStatus.SUSPENDED: "Приостановлена",
    CoachLinkStatus.ENDED: "Завершена",
    CoachLinkStatus.DECLINED: "Отклонена",
}


class CalendarPlan(StrEnum):
    NONE = "none"
    EKP = "ekp"
    REGIONAL = "regional"


CALENDAR_PLAN_TITLES: dict[CalendarPlan, str] = {
    CalendarPlan.NONE: "Не включено",
    CalendarPlan.EKP: "ЕКП Минспорта России",
    CalendarPlan.REGIONAL: "Календарный план Оренбургской области",
}


class RatingSeason(StrEnum):
    ROLLING = "rolling"
    CALENDAR = "calendar"


RATING_SEASON_TITLES: dict[RatingSeason, str] = {
    RatingSeason.ROLLING: "Последние 365 дней",
    RatingSeason.CALENDAR: "Календарный год",
}


class AppealStatus(StrEnum):
    SUBMITTED = "submitted"
    REVIEWING = "reviewing"
    UPHELD = "upheld"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


APPEAL_STATUS_TITLES: dict[AppealStatus, str] = {
    AppealStatus.SUBMITTED: "Подана",
    AppealStatus.REVIEWING: "На рассмотрении",
    AppealStatus.UPHELD: "Удовлетворена",
    AppealStatus.REJECTED: "Отклонена",
    AppealStatus.WITHDRAWN: "Отозвана",
}


class ViolationStatus(StrEnum):
    REPORTED = "reported"
    DECIDED = "decided"
    DISMISSED = "dismissed"


VIOLATION_STATUS_TITLES: dict[ViolationStatus, str] = {
    ViolationStatus.REPORTED: "Ждёт решения",
    ViolationStatus.DECIDED: "Решение принято",
    ViolationStatus.DISMISSED: "Не подтвердилось",
}


class Sanction(StrEnum):
    WARNING = "warning"
    TECHNICAL_DEFEAT = "technical_defeat"
    DISQUALIFICATION = "disqualification"
    SUSPENSION = "suspension"


SANCTION_TITLES: dict[Sanction, str] = {
    Sanction.WARNING: "Предупреждение",
    Sanction.TECHNICAL_DEFEAT: "Техническое поражение",
    Sanction.DISQUALIFICATION: "Дисквалификация на соревнование",
    Sanction.SUSPENSION: "Отстранение на срок",
}


class EnrollmentEnd(StrEnum):
    TRANSFERRED = "transferred"
    EXPELLED = "expelled"


ENROLLMENT_END_TITLES: dict[EnrollmentEnd, str] = {
    EnrollmentEnd.TRANSFERRED: "Переведён",
    EnrollmentEnd.EXPELLED: "Отчислен",
}


class SessionFormat(StrEnum):
    OFFLINE = "offline"
    ONLINE = "online"


SESSION_FORMAT_TITLES: dict[SessionFormat, str] = {
    SessionFormat.OFFLINE: "Очно",
    SessionFormat.ONLINE: "Онлайн",
}


class NormKind(StrEnum):
    OFP = "ofp"
    SFP = "sfp"


NORM_KIND_TITLES: dict[NormKind, str] = {
    NormKind.OFP: "Общая физическая подготовка",
    NormKind.SFP: "Специальная физическая подготовка",
}


class NormDirection(StrEnum):
    HIGHER = "higher"
    LOWER = "lower"


NORM_DIRECTION_TITLES: dict[NormDirection, str] = {
    NormDirection.HIGHER: "не менее",
    NormDirection.LOWER: "не более",
}


class NormUnit(StrEnum):
    SECONDS = "seconds"
    MIN_SEC = "min_sec"
    CENTIMETERS = "centimeters"
    TIMES = "times"
    CHARS = "chars"


NORM_UNIT_TITLES: dict[NormUnit, str] = {
    NormUnit.SECONDS: "с",
    NormUnit.MIN_SEC: "мин, с",
    NormUnit.CENTIMETERS: "см",
    NormUnit.TIMES: "количество раз",
    NormUnit.CHARS: "знаков в минуту",
}


class AttestationResult(StrEnum):
    TRANSFERRED = "transferred"
    RETAINED = "retained"


ATTESTATION_RESULT_TITLES: dict[AttestationResult, str] = {
    AttestationResult.TRANSFERRED: "Переведён на следующий этап",
    AttestationResult.RETAINED: "Оставлен на этапе",
}

NEXT_STAGE: dict[TrainingStage, TrainingStage] = {
    TrainingStage.INITIAL: TrainingStage.TRAINING,
    TrainingStage.TRAINING: TrainingStage.IMPROVEMENT,
    TrainingStage.IMPROVEMENT: TrainingStage.HIGHEST,
}
