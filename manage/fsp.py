import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IMAGE = "fsp"
CONTAINER = "fsp"
PORT = 8000


def docker(*args: str, quiet: bool = False) -> int:
    output = subprocess.DEVNULL if quiet else None
    return subprocess.run(["docker", *args], cwd=ROOT, stdout=output, stderr=output).returncode


def remove_container() -> None:
    docker("rm", "-f", CONTAINER, quiet=True)


def build() -> None:
    remove_container()
    docker("rmi", "-f", IMAGE, quiet=True)
    if docker("build", "--no-cache", "-f", "manage/Dockerfile", "-t", IMAGE, ".") == 0:
        print("\nОбраз собран.")
    else:
        print("\nСборка упала, смотри вывод выше.")


def start() -> None:
    remove_container()
    if docker("run", "-d", "--name", CONTAINER, "-p", f"{PORT}:8000", "-p", "9000:9000", IMAGE) != 0:
        print("\nНе запустилось. Образ собран? (пункт 1)")
        return
    print(f"\nЗапущено: http://localhost:{PORT}/docs")
    print(f"Логи: docker logs -f {CONTAINER}")


def stop() -> None:
    remove_container()
    print("\nОстановлено, данные сброшены.")


ACTIONS = {
    "1": ("Собрать / пересобрать", build),
    "2": ("Запустить", start),
    "3": ("Остановить", stop),
}


def main() -> None:
    while True:
        print("\n=== ФСП ===")
        for key, (title, _) in ACTIONS.items():
            print(f"{key}. {title}")
        print("0. Выход")
        choice = input("> ").strip()
        if choice == "0":
            return
        action = ACTIONS.get(choice)
        if action is None:
            print("Нет такого пункта")
            continue
        action[1]()


if __name__ == "__main__":
    try:
        main()
    except (KeyboardInterrupt, EOFError):
        sys.exit(0)
