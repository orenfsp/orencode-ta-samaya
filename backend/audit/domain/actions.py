from enum import StrEnum


class AuditAction(StrEnum):
    AUTH_REGISTER = "auth.register"
    AUTH_LOGIN = "auth.login"
    AUTH_LOGIN_FAILED = "auth.login_failed"
    AUTH_LOGOUT = "auth.logout"
    AUTH_PASSWORD_RESET_REQUESTED = "auth.password_reset_requested"
    AUTH_PASSWORD_RESET = "auth.password_reset"
    ROLE_REQUEST = "role.request"
    ROLE_APPROVE = "role.approve"
    ROLE_REJECT = "role.reject"
    ROLE_RESET = "role.reset"
    DICTIONARY_CREATE = "dictionary.create"
    DICTIONARY_UPDATE = "dictionary.update"
    DICTIONARY_DELETE = "dictionary.delete"
    DICTIONARY_ARCHIVE = "dictionary.archive"
    DICTIONARY_RESTORE = "dictionary.restore"
    FILE_UPLOAD = "file.upload"
    CONTEST_CREATE = "contest.create"
    CONTEST_UPDATE = "contest.update"
    CONTEST_DELETE = "contest.delete"
    CONTEST_STATUS = "contest.status"
    CONTEST_VERIFICATION = "contest.verification"
    NEWS_CREATE = "news.create"
    NEWS_UPDATE = "news.update"
    NEWS_PUBLISH = "news.publish"
    NEWS_UNPUBLISH = "news.unpublish"
    NEWS_ARCHIVE = "news.archive"
    NEWS_RESTORE = "news.restore"
    CALENDAR_CREATE = "calendar.create"
    CALENDAR_UPDATE = "calendar.update"
    CALENDAR_PUBLISH = "calendar.publish"
    CALENDAR_UNPUBLISH = "calendar.unpublish"
    CALENDAR_ARCHIVE = "calendar.archive"
    APPLICATION_CREATE = "application.create"
    APPLICATION_UPDATE = "application.update"
    APPLICATION_MEMBER_ADD = "application.member_add"
    APPLICATION_MEMBER_REMOVE = "application.member_remove"
    APPLICATION_CONFIRM = "application.confirm"
    APPLICATION_DECLINE = "application.decline"
    APPLICATION_SUBMIT = "application.submit"
    APPLICATION_WITHDRAW = "application.withdraw"
    APPLICATION_APPROVE = "application.approve"
    APPLICATION_REJECT = "application.reject"
    APPLICATION_RESET = "application.reset"
    PROFILE_UPDATE = "profile.update"
    CONSENT_SUBMIT = "consent.submit"
    CONSENT_APPROVE = "consent.approve"
    CONSENT_REJECT = "consent.reject"
    RESULTS_UPDATE = "results.update"
    DOCUMENTS_ISSUE = "documents.issue"
    DOCUMENTS_REMOVE = "documents.remove"
    PERSON_PAGE_UPDATE = "person_page.update"
    WALL_POST_UPDATE = "wall_post.update"
    WALL_POST_MODERATE = "wall_post.moderate"
    AUTH_EMAIL_VERIFIED = "auth.email_verified"
    PROFILE_EMAIL_CHANGE = "profile.email_change"
    QUALIFICATION_SUBMIT = "qualification.submit"
    QUALIFICATION_WITHDRAW = "qualification.withdraw"
    QUALIFICATION_APPROVE = "qualification.approve"
    QUALIFICATION_REJECT = "qualification.reject"
    JUDGE_ASSIGN = "judge.assign"
    JUDGE_UPDATE = "judge.update"
    JUDGE_REMOVE = "judge.remove"
    JUDGE_DOCUMENT_UPLOAD = "judge_document.upload"
    JUDGE_DOCUMENT_REPLACE = "judge_document.replace"
    JUDGE_DOCUMENT_REMOVE = "judge_document.remove"
    ORGANIZATION_CREATE = "organization.create"
    ORGANIZATION_UPDATE = "organization.update"
    SPORT_PROFILE_UPDATE = "sport_profile.update"
    COACH_LINK_REQUEST = "coach_link.request"
    COACH_LINK_CHANGE = "coach_link.change"
    ANTIDOPING_SAVE = "antidoping.save"
    REPORT_DEADLINE_SAVE = "report_deadline.save"
    APPLICATION_REPEAT = "application.repeat"
    EVSK_RULE_SAVE = "evsk_rule.save"
    RATING_SETTINGS_SAVE = "rating.settings_save"
    APPEAL_SUBMIT = "appeal.submit"
    APPEAL_WITHDRAW = "appeal.withdraw"
    APPEAL_REVIEW = "appeal.review"
    APPEAL_DECIDE = "appeal.decide"
    VIOLATION_REPORT = "violation.report"
    VIOLATION_DECIDE = "violation.decide"
    SQUAD_APPROVE = "squad.approve"
    SQUAD_REPLACE = "squad.replace"
    SQUAD_DISSOLVE = "squad.dissolve"
    TRAINING_PROGRAM_SAVE = "training_program.save"
    ORGANIZATION_COACH_SAVE = "organization_coach.save"
    TRAINING_GROUP_SAVE = "training_group.save"
    ENROLLMENT_ADD = "enrollment.add"
    ENROLLMENT_TRANSFER = "enrollment.transfer"
    ENROLLMENT_EXPEL = "enrollment.expel"
    TRAINING_SESSION_SAVE = "training_session.save"
    TRAINING_SESSION_REMOVE = "training_session.remove"
    NORM_SAVE = "norm.save"
    NORM_RESULT_ADD = "norm_result.add"
    ATTESTATION_DECIDE = "attestation.decide"

    @property
    def label(self) -> str:
        """Возвращает русское название действия."""
        return ACTION_LABELS[self]


A = AuditAction

ACTION_LABELS: dict[str, str] = {
    A.AUTH_REGISTER: "Регистрация аккаунта",
    A.AUTH_LOGIN: "Вход в аккаунт",
    A.AUTH_LOGIN_FAILED: "Неудачный вход",
    A.AUTH_LOGOUT: "Выход из аккаунта",
    A.AUTH_PASSWORD_RESET_REQUESTED: "Запрошен сброс пароля",
    A.AUTH_PASSWORD_RESET: "Пароль изменён",
    A.ROLE_REQUEST: "Запрошена роль",
    A.ROLE_APPROVE: "Роль подтверждена",
    A.ROLE_REJECT: "В роли отказано",
    A.ROLE_RESET: "Роль возвращена на проверку",
    A.DICTIONARY_CREATE: "Добавлена запись справочника",
    A.DICTIONARY_UPDATE: "Изменена запись справочника",
    A.DICTIONARY_DELETE: "Удалена запись справочника",
    A.DICTIONARY_ARCHIVE: "Запись справочника в архиве",
    A.DICTIONARY_RESTORE: "Запись справочника восстановлена",
    A.FILE_UPLOAD: "Загружен файл",
    A.CONTEST_CREATE: "Создано соревнование",
    A.CONTEST_UPDATE: "Изменено соревнование",
    A.CONTEST_DELETE: "Удалено соревнование",
    A.CONTEST_STATUS: "Изменён статус соревнования",
    A.CONTEST_VERIFICATION: "Изменена верификация соревнования",
    A.NEWS_CREATE: "Создана статья",
    A.NEWS_UPDATE: "Изменена статья",
    A.NEWS_PUBLISH: "Статья опубликована",
    A.NEWS_UNPUBLISH: "Статья снята с публикации",
    A.NEWS_ARCHIVE: "Статья в архиве",
    A.NEWS_RESTORE: "Статья восстановлена",
    A.CALENDAR_CREATE: "Создано событие",
    A.CALENDAR_UPDATE: "Изменено событие",
    A.CALENDAR_PUBLISH: "Событие опубликовано",
    A.CALENDAR_UNPUBLISH: "Событие снято с публикации",
    A.CALENDAR_ARCHIVE: "Событие в архиве",
    A.APPLICATION_CREATE: "Создана заявка",
    A.APPLICATION_UPDATE: "Изменена заявка",
    A.APPLICATION_MEMBER_ADD: "Участник добавлен в заявку",
    A.APPLICATION_MEMBER_REMOVE: "Участник убран из заявки",
    A.APPLICATION_CONFIRM: "Участие подтверждено",
    A.APPLICATION_DECLINE: "Отказ от участия",
    A.APPLICATION_SUBMIT: "Заявка подана",
    A.APPLICATION_WITHDRAW: "Заявка отозвана",
    A.APPLICATION_APPROVE: "Заявка одобрена",
    A.APPLICATION_REJECT: "Заявка отклонена",
    A.APPLICATION_RESET: "Заявка возвращена на рассмотрение",
    A.PROFILE_UPDATE: "Профиль изменён",
    A.CONSENT_SUBMIT: "Подано согласие представителя",
    A.CONSENT_APPROVE: "Согласие представителя одобрено",
    A.CONSENT_REJECT: "Согласие представителя отклонено",
    A.RESULTS_UPDATE: "Внесены места соревнования",
    A.DOCUMENTS_ISSUE: "Выпущены документы соревнования",
    A.DOCUMENTS_REMOVE: "Убраны документы соревнования",
    A.PERSON_PAGE_UPDATE: "Изменены настройки страницы",
    A.WALL_POST_UPDATE: "Изменён пост ленты",
    A.WALL_POST_MODERATE: "Федерация скрыла или вернула пост",
    A.AUTH_EMAIL_VERIFIED: "Почта подтверждена",
    A.PROFILE_EMAIL_CHANGE: "Почта изменена",
    A.QUALIFICATION_SUBMIT: "Подана заявка на разряд или категорию",
    A.QUALIFICATION_WITHDRAW: "Заявка на разряд или категорию отозвана",
    A.QUALIFICATION_APPROVE: "Присвоен разряд или категория",
    A.QUALIFICATION_REJECT: "Отказ в разряде или категории",
    A.JUDGE_ASSIGN: "Судья назначен в коллегию",
    A.JUDGE_UPDATE: "Изменена должность судьи",
    A.JUDGE_REMOVE: "Судья снят с коллегии",
    A.JUDGE_DOCUMENT_UPLOAD: "Судья загрузил документ к протоколу",
    A.JUDGE_DOCUMENT_REPLACE: "Судья заменил документ к протоколу",
    A.JUDGE_DOCUMENT_REMOVE: "Судья удалил документ к протоколу",
    A.ORGANIZATION_CREATE: "Добавлена организация",
    A.ORGANIZATION_UPDATE: "Изменена организация",
    A.SPORT_PROFILE_UPDATE: "Изменён спортивный профиль",
    A.COACH_LINK_REQUEST: "Тренер запросил привязку спортсмена",
    A.COACH_LINK_CHANGE: "Изменена связь тренера и спортсмена",
    A.ANTIDOPING_SAVE: "Отмечен антидопинговый курс",
    A.REPORT_DEADLINE_SAVE: "Изменён отчётный срок",
    A.APPLICATION_REPEAT: "Заявка подана тем же составом",
    A.EVSK_RULE_SAVE: "Изменены правила ЕВСК",
    A.RATING_SETTINGS_SAVE: "Изменены правила рейтинга",
    A.APPEAL_SUBMIT: "Подана апелляция на результат",
    A.APPEAL_WITHDRAW: "Апелляция отозвана",
    A.APPEAL_REVIEW: "Апелляция взята на рассмотрение",
    A.APPEAL_DECIDE: "Решение по апелляции",
    A.VIOLATION_REPORT: "Рапорт о нарушении",
    A.VIOLATION_DECIDE: "Решение по нарушению",
    A.SQUAD_APPROVE: "Утверждена сборная",
    A.SQUAD_REPLACE: "Сборная обновлена новым приказом",
    A.SQUAD_DISSOLVE: "Сборная расформирована",
    A.TRAINING_PROGRAM_SAVE: "Изменены программы подготовки организации",
    A.ORGANIZATION_COACH_SAVE: "Изменён состав тренеров-преподавателей",
    A.TRAINING_GROUP_SAVE: "Создана или изменена учебно-тренировочная группа",
    A.ENROLLMENT_ADD: "Спортсмен зачислен в группу",
    A.ENROLLMENT_TRANSFER: "Спортсмен переведён в другую группу",
    A.ENROLLMENT_EXPEL: "Спортсмен отчислен из группы",
    A.TRAINING_SESSION_SAVE: "Занятие записано в журнал",
    A.TRAINING_SESSION_REMOVE: "Занятие удалено из журнала",
    A.NORM_SAVE: "Изменён справочник нормативов",
    A.NORM_RESULT_ADD: "Внесены результаты сдачи нормативов",
    A.ATTESTATION_DECIDE: "Решение по промежуточной аттестации",
}

AUDIT_OBJECTS: dict[str, str] = {
    "user": "Аккаунт",
    "user_role": "Роль",
    "guardian_consent": "Согласие представителя",
    "file": "Файл",
    "contest": "Соревнование",
    "contest_application": "Заявка на участие",
    "calendar_event": "Событие календаря",
    "news_article": "Статья",
    "person_page": "Страница человека",
    "wall_post": "Пост ленты",
    "qualification": "Разряд или категория",
    "judge_assignment": "Назначение судьи",
    "judge_document": "Документ судьи",
    "organization": "Организация",
    "coach_link": "Связь тренера и спортсмена",
    "squad": "Сборная",
    "training_group": "Учебно-тренировочная группа",
    "training_session": "Занятие",
    "standard_norm": "Норматив",
    "attestation": "Аттестация",
}
