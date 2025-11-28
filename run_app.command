#!/bin/bash

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR" || exit 1

PYTHON_BIN=""
for candidate in python3 python; do
  if command -v "$candidate" >/dev/null 2>&1; then
    PYTHON_BIN="$candidate"
    break
  fi
done

if [[ -z "$PYTHON_BIN" ]]; then
  echo "Python 3 не найден. Установите его с https://www.python.org/downloads/."
  read -r -p "Нажмите Enter, чтобы закрыть окно..." _
  exit 1
fi

SERVER_PORT=8080

cleanup() {
  if [[ -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" >/dev/null 2>&1
  fi
}

trap cleanup EXIT

load_env_file() {
  local file="$1"
  if [ -f "$file" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$file"
    set +a
  fi
}

echo "Каталог проекта: $DIR"
read -r -p "Нажмите Enter, чтобы запустить приложение..." _

load_env_file ".env"
load_env_file "gpt5-pro.env"

echo "Запускаю backend на порту ${SERVER_PORT}..."
"$PYTHON_BIN" server.py &
SERVER_PID=$!

max_attempts=15
attempt=0
until lsof -nP -i ":${SERVER_PORT}" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [[ $attempt -ge $max_attempts ]]; then
    echo "Не удалось запустить сервер (порт ${SERVER_PORT} не слушает)."
    wait "$SERVER_PID"
    read -r -p "Нажмите Enter, чтобы закрыть окно..." _
    exit 1
  fi
  sleep 1
done

APP_URL="http://localhost:${SERVER_PORT}/"
echo "Открываю ${APP_URL} в браузере..."
open "${APP_URL}"

echo "Сервер работает. Нажмите Ctrl+C в этом окне, чтобы остановить приложение."
wait "$SERVER_PID"
