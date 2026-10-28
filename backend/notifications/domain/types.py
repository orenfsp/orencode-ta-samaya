from enum import StrEnum


class NotificationType(StrEnum):
    AUTH_PASSWORD_RESET = "auth.password_reset"
    AUTH_EMAIL_VERIFY = "auth.email_verify"
    AUTH_EMAIL_CHANGE = "auth.email_change"
    AUTH_PASSWORD_CHANGED = "auth.password_changed"
    AUTH_NEW_DEVICE = "auth.new_device"
    AUTH_EMAIL_CHANGED = "auth.email_changed"
    ROLE_REQUESTED = "role.requested"
    ROLE_APPROVED = "role.approved"
    ROLE_REJECTED = "role.rejected"
    ROLE_RESET = "role.reset"
    CONTEST_VERIFICATION_REQUESTED = "contest.verification_requested"
    CONTEST_VERIFIED = "contest.verified"
    CONTEST_VERIFICATION_REJECTED = "contest.verification_rejected"
    CONTEST_VERIFICATION_REVOKED = "contest.verification_revoked"
    CONTEST_CANCELLED = "contest.cancelled"
    APPLICATION_INVITED = "application.invited"
    APPLICATION_MEMBER_DECLINED = "application.member_declined"
    APPLICATION_SUBMITTED = "application.submitted"
    APPLICATION_APPROVED = "application.approved"
    APPLICATION_REJECTED = "application.rejected"
    APPLICATION_RESET = "application.reset"
    RESULTS_ENTERED = "results.entered"
    QUALIFICATION_REQUESTED = "qualification.requested"
    QUALIFICATION_APPROVED = "qualification.approved"
    QUALIFICATION_REJECTED = "qualification.rejected"
    QUALIFICATION_EXPIRING = "qualification.expiring"
    QUALIFICATION_EXPIRED = "qualification.expired"
    JUDGE_ASSIGNED = "judge.assigned"
    JUDGE_REMOVED = "judge.removed"
    SYSTEM_TEST = "system.test"
    CONSENT_SUBMITTED = "consent.submitted"
    CONSENT_APPROVED = "consent.approved"
    CONSENT_REJECTED = "consent.rejected"
    SQUAD_INCLUDED = "squad.included"


class NotificationGroup(StrEnum):
    SECURITY = "security"
    ROLES = "roles"
    CONTESTS = "contests"
    APPLICATIONS = "applications"
    QUALIFICATIONS = "qualifications"
    MODERATION = "moderation"


T, G = NotificationType, NotificationGroup

GROUPS: dict[str, NotificationGroup] = {
    T.AUTH_PASSWORD_RESET: G.SECURITY,
    T.AUTH_EMAIL_VERIFY: G.SECURITY,
    T.AUTH_EMAIL_CHANGE: G.SECURITY,
    T.AUTH_PASSWORD_CHANGED: G.SECURITY,
    T.AUTH_NEW_DEVICE: G.SECURITY,
    T.AUTH_EMAIL_CHANGED: G.SECURITY,
    T.ROLE_REQUESTED: G.MODERATION,
    T.CONSENT_SUBMITTED: G.MODERATION,
    T.CONSENT_APPROVED: G.ROLES,
    T.CONSENT_REJECTED: G.ROLES,
    T.ROLE_APPROVED: G.ROLES,
    T.ROLE_REJECTED: G.ROLES,
    T.ROLE_RESET: G.ROLES,
    T.CONTEST_VERIFICATION_REQUESTED: G.MODERATION,
    T.CONTEST_VERIFIED: G.CONTESTS,
    T.CONTEST_VERIFICATION_REJECTED: G.CONTESTS,
    T.CONTEST_VERIFICATION_REVOKED: G.CONTESTS,
    T.CONTEST_CANCELLED: G.CONTESTS,
    T.APPLICATION_INVITED: G.APPLICATIONS,
    T.APPLICATION_MEMBER_DECLINED: G.APPLICATIONS,
    T.APPLICATION_SUBMITTED: G.MODERATION,
    T.APPLICATION_APPROVED: G.APPLICATIONS,
    T.APPLICATION_REJECTED: G.APPLICATIONS,
    T.APPLICATION_RESET: G.APPLICATIONS,
    T.RESULTS_ENTERED: G.CONTESTS,
    T.QUALIFICATION_REQUESTED: G.MODERATION,
    T.QUALIFICATION_APPROVED: G.QUALIFICATIONS,
    T.QUALIFICATION_REJECTED: G.QUALIFICATIONS,
    T.QUALIFICATION_EXPIRING: G.QUALIFICATIONS,
    T.QUALIFICATION_EXPIRED: G.QUALIFICATIONS,
    T.JUDGE_ASSIGNED: G.CONTESTS,
    T.JUDGE_REMOVED: G.CONTESTS,
    T.SQUAD_INCLUDED: G.CONTESTS,
    T.SYSTEM_TEST: G.SECURITY,
}

GROUP_LABELS: dict[NotificationGroup, tuple[str, str]] = {
    G.SECURITY: ("Безопасность", "Коды, смена пароля и почты, вход с нового устройства"),
    G.ROLES: ("Роли", "Решения федерации по вашим ролям"),
    G.CONTESTS: ("Соревнования", "Верификация, отмена, результаты, назначения судей и сборные"),
    G.QUALIFICATIONS: ("Разряды и категории", "Решения федерации и сроки разрядов и судейских категорий"),
    G.APPLICATIONS: ("Заявки", "Приглашения в команды и решения по заявкам"),
    G.MODERATION: ("Модерация", "Заявки на роли, участие, разряды и категории, соревнования на верификацию"),
}

CODE_TYPES = frozenset({T.AUTH_PASSWORD_RESET, T.AUTH_EMAIL_VERIFY, T.AUTH_EMAIL_CHANGE})
