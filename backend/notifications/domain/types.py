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
    COACH_LINK_REQUESTED = "coach_link.requested"
    COACH_LINK_DECIDED = "coach_link.decided"
    COACH_LINK_CHANGED = "coach_link.changed"
    DEADLINE_REGISTRATION = "deadline.registration_closing"
    DEADLINE_GOVERNOR = "deadline.governor_awards"
    DEADLINE_REPORT = "deadline.report"
    ANTIDOPING_EXPIRING = "antidoping.expiring"
    RANK_POSSIBLE = "rank.possible"
    APPEAL_SUBMITTED = "appeal.submitted"
    APPEAL_REVIEWING = "appeal.reviewing"
    APPEAL_DECIDED = "appeal.decided"
    VIOLATION_REPORTED = "violation.reported"
    VIOLATION_DECIDED = "violation.decided"
    SYSTEM_TEST = "system.test"
    CONSENT_SUBMITTED = "consent.submitted"
    CONSENT_APPROVED = "consent.approved"
    CONSENT_REJECTED = "consent.rejected"
    SQUAD_INCLUDED = "squad.included"
    TRAINING_ENROLLMENT = "training.enrollment"
    TRAINING_ATTESTATION = "training.attestation"


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
    T.COACH_LINK_REQUESTED: G.APPLICATIONS,
    T.COACH_LINK_DECIDED: G.APPLICATIONS,
    T.COACH_LINK_CHANGED: G.APPLICATIONS,
    T.DEADLINE_REGISTRATION: G.APPLICATIONS,
    T.DEADLINE_GOVERNOR: G.MODERATION,
    T.DEADLINE_REPORT: G.MODERATION,
    T.ANTIDOPING_EXPIRING: G.QUALIFICATIONS,
    T.RANK_POSSIBLE: G.QUALIFICATIONS,
    T.APPEAL_SUBMITTED: G.MODERATION,
    T.APPEAL_REVIEWING: G.CONTESTS,
    T.APPEAL_DECIDED: G.CONTESTS,
    T.VIOLATION_REPORTED: G.MODERATION,
    T.VIOLATION_DECIDED: G.CONTESTS,
    T.TRAINING_ENROLLMENT: G.APPLICATIONS,
    T.TRAINING_ATTESTATION: G.APPLICATIONS,
    T.SYSTEM_TEST: G.SECURITY,
}

GROUP_LABELS: dict[NotificationGroup, tuple[str, str]] = {
    G.SECURITY: ("Безопасность", "Коды, смена пароля и почты, вход с нового устройства"),
    G.ROLES: ("Роли", "Решения федерации по вашим ролям"),
    G.CONTESTS: ("Соревнования", "Верификация, отмена, результаты, апелляции и нарушения, назначения судей и сборные"),
    G.QUALIFICATIONS: ("Разряды и категории", "Решения федерации и сроки разрядов и судейских категорий"),
    G.APPLICATIONS: ("Заявки и тренеры", "Приглашения в команды, решения по заявкам, привязка к тренеру, группы и аттестация"),
    G.MODERATION: ("Модерация", "Заявки на роли, участие, разряды и категории, соревнования на верификацию, апелляции и рапорты"),
}

CODE_TYPES = frozenset({T.AUTH_PASSWORD_RESET, T.AUTH_EMAIL_VERIFY, T.AUTH_EMAIL_CHANGE})
