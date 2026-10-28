import os
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IMAGE = "fsp"
CONTAINER = "fsp"
PORT = 8000
FRONTEND = ROOT / "frontend"
FRONTEND_PORT = 5173
FRONTEND_PID = Path(tempfile.gettempdir()) / "fsp-frontend.pid"
FRONTEND_LOG = Path(tempfile.gettempdir()) / "fsp-frontend.log"
ENV = (
    "FSP_TELEGRAM_BOT_TOKEN",
    "FSP_FRONTEND_URL",
    "FSP_MAILPIT_URL",
    "FSP_SMTP_HOST",
    "FSP_SMTP_PORT",
    "FSP_SMTP_TLS_MODE",
    "FSP_SMTP_USERNAME",
    "FSP_SMTP_PASSWORD",
    "FSP_SMTP_SENDER",
)


def docker(*args: str, quiet: bool = False) -> int:
    """Запускает команду docker из корня проекта и возвращает её код завершения."""
    output = subprocess.DEVNULL if quiet else None
    return subprocess.run(["docker", *args], cwd=ROOT, stdout=output, stderr=output).returncode


def remove_container() -> None:
    """Удаляет контейнер приложения, если он есть."""
    docker("rm", "-f", CONTAINER, quiet=True)


def port_open(port: int) -> bool:
    """Проверяет, слушает ли кто-то порт на localhost по IPv4 или IPv6."""
    for host in ("127.0.0.1", "::1"):
        try:
            with socket.create_connection((host, port), timeout=0.5):
                return True
        except OSError:
            pass
    return False


def stop_frontend() -> None:
    """Останавливает dev-сервер фронтенда вместе с дочерними процессами, если его запускал этот скрипт."""
    if not FRONTEND_PID.exists():
        return
    pid = int(FRONTEND_PID.read_text())
    FRONTEND_PID.unlink()
    if os.name == "nt":
        subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    else:
        try:
            os.killpg(pid, signal.SIGTERM)
        except ProcessLookupError:
            pass


def npm_run(*args: str) -> bool:
    """Выполняет команду npm в папке фронтенда и сообщает, прошла ли она."""
    npm = shutil.which("npm")
    if npm is None:
        print("Не найден npm, нужен Node.js 20+")
        return False
    if subprocess.run([npm, *args], cwd=FRONTEND).returncode != 0:
        print(f"\nnpm {' '.join(args)} упал, смотри вывод выше.")
        return False
    return True


def build_frontend() -> None:
    """Ставит зависимости фронтенда и собирает его (npm install, npm run build)."""
    print("\nСтавлю зависимости фронтенда (npm install)...")
    if not npm_run("install"):
        return
    print("\nСобираю фронтенд (npm run build)...")
    if npm_run("run", "build"):
        print("\nФронтенд собран.")


# Vite запускается в фоне отдельной группой процессов: живёт после выхода из меню, гасится пунктом «Остановить».
# Хост 127.0.0.1 задан явно: по умолчанию Node на Windows слушает только ::1, и по IPv4 сайт недоступен
def start_frontend() -> None:
    """Ставит зависимости фронтенда (npm install) и поднимает dev-сервер Vite (npm run dev) в фоне."""
    stop_frontend()
    if port_open(FRONTEND_PORT):
        print(f"Сайт: http://localhost:{FRONTEND_PORT} (порт уже занят: dev-сервер запущен не этим скриптом)")
        return
    print("\nСтавлю зависимости фронтенда (npm install)...")
    if not npm_run("install"):
        print("Сайт не запущен.")
        return
    npm = shutil.which("npm") or "npm"
    windows = os.name == "nt"
    flags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW if windows else 0
    with FRONTEND_LOG.open("w", encoding="utf-8") as log:
        process = subprocess.Popen(
            [npm, "run", "dev", "--", "--host", "127.0.0.1"],
            cwd=FRONTEND,
            stdin=subprocess.DEVNULL,
            stdout=log,
            stderr=subprocess.STDOUT,
            creationflags=flags,
            start_new_session=not windows,
        )
    FRONTEND_PID.write_text(str(process.pid))
    for _ in range(60):
        if port_open(FRONTEND_PORT):
            print(f"Сайт: http://localhost:{FRONTEND_PORT}")
            return
        if process.poll() is not None:
            break
        time.sleep(0.5)
    print(f"Сайт не поднялся, лог: {FRONTEND_LOG}")


def build() -> None:
    """Пересобирает образ приложения с нуля без кэша, затем ставит зависимости и собирает фронтенд."""
    remove_container()
    docker("rmi", "-f", IMAGE, quiet=True)
    if docker("build", "--no-cache", "-f", "manage/Dockerfile", "-t", IMAGE, ".") == 0:
        print("\nОбраз собран.")
    else:
        print("\nСборка упала, смотри вывод выше.")
    build_frontend()


def start() -> None:
    """Запускает контейнер приложения с переменными окружения и портами."""
    remove_container()
    env = [item for name in ENV for item in ("-e", name) if os.environ.get(name)]
    real_mail = bool(os.environ.get("FSP_SMTP_HOST"))
    if real_mail and not os.environ.get("FSP_MAILPIT_URL"):
        env += ["-e", "FSP_MAILPIT_URL="]
    ports = ["-p", f"{PORT}:8000", "-p", "9000:9000", "-p", "127.0.0.1:8025:8025"]
    if docker("run", "-d", "--name", CONTAINER, *ports, *env, IMAGE) != 0:
        print("\nНе запустилось. Образ собран? (пункт 1)")
        return
    print(f"\nЗапущено: http://localhost:{PORT}/docs")
    print(f"Письма: через {os.environ['FSP_SMTP_HOST']}" if real_mail else "Письма: http://localhost:8025")
    if not os.environ.get("FSP_TELEGRAM_BOT_TOKEN"):
        print("Telegram выключен: задайте FSP_TELEGRAM_BOT_TOKEN перед запуском")
    print(f"Логи: docker logs -f {CONTAINER}")
    start_frontend()


def stop() -> None:
    """Останавливает dev-сервер фронтенда и удаляет контейнер приложения."""
    stop_frontend()
    remove_container()
    print("\nОстановлено, данные сброшены.")


ACTIONS = (
    ("Собрать / пересобрать", build),
    ("Запустить", start),
    ("Остановить", stop),
    ("Выход", None),
)
UP, DOWN, ENTER, QUIT = "up", "down", "enter", "quit"


# Одно нажатие без Enter: на Windows через msvcrt, иначе терминал на время чтения переводится в сырой режим
def read_key() -> str:
    """Считывает одно нажатие клавиши и возвращает код действия: стрелка, Enter, выход или цифра."""
    if os.name == "nt":
        import msvcrt

        key = msvcrt.getwch()
        if key in ("\x00", "\xe0"):
            return {"H": UP, "P": DOWN}.get(msvcrt.getwch(), "")
    else:
        import termios
        import tty

        fd = sys.stdin.fileno()
        saved = termios.tcgetattr(fd)
        try:
            tty.setraw(fd)
            key = os.read(fd, 8).decode(errors="ignore")
        finally:
            termios.tcsetattr(fd, termios.TCSADRAIN, saved)
        if key in ("\x1b[A", "\x1bOA"):
            return UP
        if key in ("\x1b[B", "\x1bOB"):
            return DOWN
    if key in ("\r", "\n"):
        return ENTER
    if key in ("\x1b", "\x03", "q", "й"):
        return QUIT
    if key.isdigit() and 1 <= int(key) <= len(ACTIONS):
        return key
    return ""


# Пункты меню; выбранный подсвечен. При перерисовке курсор поднимается на высоту меню и строки пишутся поверх
def draw(selected: int, redraw: bool) -> None:
    """Печатает пункты меню, подсвечивая выбранный; при повторной отрисовке перезаписывает прежние строки."""
    if redraw:
        sys.stdout.write(f"\x1b[{len(ACTIONS)}F")
    for index, (title, _) in enumerate(ACTIONS):
        line = f"\x1b[7m › {title} \x1b[0m" if index == selected else f"   {title}"
        sys.stdout.write(f"\x1b[2K{line}\n")
    sys.stdout.flush()


# Стрелки двигают выбор по кругу, Enter или цифра выбирают пункт, Esc / q / Ctrl+C — выход
def choose(selected: int) -> int | None:
    """Показывает меню и ждёт выбора пункта; None, если пользователь вышел."""
    print("\n=== ФСП ===  ↑↓ выбрать · Enter выполнить · Esc выход")
    draw(selected, redraw=False)
    while True:
        key = read_key()
        if key == QUIT:
            return None
        if key == ENTER:
            return selected
        if key.isdigit():
            return int(key) - 1
        if key in (UP, DOWN):
            selected = (selected + (1 if key == DOWN else -1)) % len(ACTIONS)
            draw(selected, redraw=True)


def main() -> None:
    """Запускает цикл меню: выбор пункта и выполнение соответствующего действия."""
    if os.name == "nt":
        os.system("")  # включает ANSI-последовательности в консоли Windows
    selected = 0
    while True:
        choice = choose(selected)
        if choice is None:
            return
        action = ACTIONS[choice][1]
        if action is None:
            return
        selected = choice
        action()


if __name__ == "__main__":
    try:
        main()
    except (KeyboardInterrupt, EOFError):
        sys.exit(0)
