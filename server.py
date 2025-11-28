#!/usr/bin/env python3
"""
Простой локальный backend для хранения описаний и ссылок Авито по кадастровым
номерам и, при наличии ключа, интеграции с YandexGPT.
Использует стандартную библиотеку Python, чтобы не требовать дополнительных зависимостей.
"""

import json
import mimetypes
import os
import threading
import urllib.error
import urllib.request
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Dict, Any
from urllib.parse import parse_qs, unquote, urlparse


ROOT_DIR = Path(__file__).resolve().parent
DATA_DIR = ROOT_DIR / "data"
DATA_PATH = DATA_DIR / "notes.json"
PUBLIC_DIR = ROOT_DIR / "public"

LOCK = threading.Lock()
YANDEX_GPT_API_URL = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"
YANDEX_GPT_API_KEY = os.getenv("YANDEX_GPT_API_KEY", "").strip()
YANDEX_GPT_MODEL_URI = os.getenv("YANDEX_GPT_MODEL_URI", "").strip()
YANDEX_GPT_ENABLED = bool(YANDEX_GPT_API_KEY and YANDEX_GPT_MODEL_URI)
YANDEX_GPT_SYSTEM_PROMPT = os.getenv("YANDEX_GPT_SYSTEM_PROMPT", "").strip()
YANDEX_GPT_FOLDER_ID = os.getenv("YANDEX_GPT_FOLDER_ID", "").strip()

DEFAULT_SYSTEM_PROMPT = (
    "Вы — профессиональный аналитик и копирайтер в сфере земельной недвижимости. "
    "Ваша задача — по сухому техническому описанию (площадь, цена, категория, кадастровый номер, "
    "локация, особенности участка) создавать структурированные и читаемые объявления для Авито.\n\n"
    "Формат и требования:\n"
    "1. Пиши в стиле экспертного каталога — чётко, уверенно, без рекламных клише и субъективных прилагательных.\n"
    "2. Структура текста:\n"
    "   - Заголовок: тип участка, площадь, цена, регион, ключевая особенность.\n"
    "   - Описание: первый абзац — образ места; второй — физические характеристики и сценарии освоения; "
    "третий — инвестиционный потенциал.\n"
    "   - Технические данные: площадь, кадастровый номер, категория, формат сделки, подъезд, коммуникации.\n"
    "   - Характер участка: рельеф, растительность, водоём, комфорт и приватность.\n"
    "   - Локация и окружение: расстояния до населённых пунктов, туристические точки, инфраструктура.\n"
    "   - Перспективы: динамика региона, транспортная доступность, драйверы роста стоимости.\n"
    "   - Инвестиционный ракурс: потенциальная доходность (глемпинг, туризм, апартаменты, фермерство и т.д.).\n"
    "   - Идеи использования: эко-усадьба, ретрит, туркомплекс, частная резиденция.\n"
    "   - Контакт: мягкий призыв написать или позвонить для получения плана и фото.\n"
    "3. Всегда подчёркивай инвестиционную ценность: редкость локации, природный ресурс, рост турпотока, развитие инфраструктуры.\n"
    "4. Избегай рекламных штампов вроде «уникальный», «великолепный», «лучшее предложение». Используй факты и последствия: "
    "«растёт интерес к локации», «земля сохраняет ликвидность», «рекреационный потенциал усиливается».\n"
    "5. Абзацы — по 2–3 предложения; ритм спокойный, без излишней поэтичности.\n"
    "6. Стиль — нейтрально-профессиональный, акцент на ценности земли как актива, а не на пейзажах.\n"
)

SYSTEM_PROMPT = YANDEX_GPT_SYSTEM_PROMPT or DEFAULT_SYSTEM_PROMPT

SUMMARY_FIELDS = [
    ("Кадастровый номер", "cadastral_number"),
    ("Регион", "region"),
    ("Артикул", "article"),
    ("Площадь (га)", "area_ha"),
    ("Цена за сотку (₽)", "price_per_sotka_rub"),
    ("Цена за участок (₽)", "price_per_plot_rub"),
    ("Допустимая скидка (%)", "discount_limit_percent"),
    ("Продажа", "wholesale_only"),
    ("ВРИ / категория", "land_use"),
    ("Рекомендованное назначение", "recommended_usage"),
    ("Описание расположения", "location_description"),
    ("Контекст", "context"),
    ("Рекомендации", "recommendations"),
    ("Служебные отметки", "service_notes"),
    ("Наилучшее использование", "best_use"),
]


def ensure_data_file() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not DATA_PATH.exists():
        DATA_PATH.write_text("{}", encoding="utf-8")


def load_notes() -> Dict[str, Dict[str, Any]]:
    ensure_data_file()
    with DATA_PATH.open("r", encoding="utf-8") as fh:
        try:
            data = json.load(fh)
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            pass
    return {}


def save_notes(notes: Dict[str, Dict[str, Any]]) -> None:
    ensure_data_file()
    with DATA_PATH.open("w", encoding="utf-8") as fh:
        json.dump(notes, fh, ensure_ascii=False, indent=2)


def humanize_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "да" if value else "нет"
    if isinstance(value, (int, float)):
        return f"{value:,}".replace(",", " ")
    return str(value).strip()


def build_prompt(record: Dict[str, Any], existing_note: Any, instruction: Any) -> str:
    lines: list[str] = []
    for label, key in SUMMARY_FIELDS:
        value = humanize_value(record.get(key))
        if value:
            lines.append(f"- {label}: {value}")

    if not lines:
        lines.append("- информации почти нет — коротко отметь это, не выдумывая фактов.")

    extras: list[str] = []
    if instruction:
        extras.append(f"- Особые пожелания менеджера: {instruction}")
    if existing_note:
        extras.append(f"- Текущий черновик клиента (если нужно улучшить): {existing_note}")

    prompt_sections = [
        "Исходные данные по участку (используй факты без искажений):",
        "\n".join(lines),
    ]

    if extras:
        prompt_sections.extend(["", "Дополнительные пометки:", *extras])

    prompt_sections.append("")
    prompt_sections.append(
        "Сформируй текст по требуемой структуре. Если данных не хватает, упоминай это лаконично и не добавляй выдуманных сведений."
    )

    return "\n".join(prompt_sections)


def call_yandex_gpt(prompt: str) -> str:
    if not YANDEX_GPT_ENABLED:
        raise RuntimeError("YandexGPT is not configured")

    body = {
        "modelUri": YANDEX_GPT_MODEL_URI,
        "completionOptions": {
            "temperature": 0.25,
            "maxTokens": 1000,
        },
        "messages": [
            {
                "role": "system",
                "text": SYSTEM_PROMPT,
            },
            {"role": "user", "text": prompt},
        ],
    }
    if YANDEX_GPT_FOLDER_ID:
        body["folderId"] = YANDEX_GPT_FOLDER_ID

    request_data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        YANDEX_GPT_API_URL,
        data=request_data,
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": f"Api-Key {YANDEX_GPT_API_KEY}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        try:
            details = error.read().decode("utf-8")
        except Exception:  # noqa: BLE001
            details = error.reason
        raise RuntimeError(f"YandexGPT API error: {details}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"Не удалось подключиться к YandexGPT: {error}") from error

    alternatives = (
        payload.get("result", {})
        .get("alternatives", [])
    )
    for alternative in alternatives:
        message = alternative.get("message") or {}
        text = message.get("text", "").strip()
        if text:
            return text

    raise RuntimeError("YandexGPT вернул пустой ответ")


class NotesHandler(BaseHTTPRequestHandler):
    server_version = "NotesServer/1.0"

    def _set_cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(HTTPStatus.NO_CONTENT)
        self._set_cors_headers()
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/proxy-map":
            params = parse_qs(parsed.query)
            value = params.get("query", [""])[0].strip()
            if not value:
                self.send_error(HTTPStatus.BAD_REQUEST, "Missing query param")
                return

            target_url = f"https://map.ru/api/kad/search?query={value}"
            try:
                request = urllib.request.Request(
                    target_url,
                    headers={"User-Agent": "Mozilla/5.0"},
                )
                with urllib.request.urlopen(request, timeout=10) as response:
                    body = response.read()
            except Exception as error:  # noqa: BLE001
                self.send_error(HTTPStatus.BAD_GATEWAY, f"Proxy error: {error}")
                return

            self.send_response(HTTPStatus.OK)
            self._set_cors_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == "/notes":
            with LOCK:
                notes = load_notes()

            payload = json.dumps(notes, ensure_ascii=False).encode("utf-8")
            self.send_response(HTTPStatus.OK)
            self._set_cors_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        self.serve_static(parsed.path)

    def do_POST(self) -> None:  # noqa: N802
        if self.path == "/notes":
            self._handle_notes_post()
            return
        if self.path == "/ai/describe":
            self._handle_ai_describe()
            return

        self.send_error(HTTPStatus.NOT_FOUND, "Endpoint not found")

    # --- Notes endpoints -------------------------------------------------

    def _handle_notes_post(self) -> None:
        content_length = int(self.headers.get("Content-Length", "0"))
        if content_length <= 0:
            self.send_error(HTTPStatus.BAD_REQUEST, "Empty body")
            return

        body = self.rfile.read(content_length).decode("utf-8")
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            self.send_error(HTTPStatus.BAD_REQUEST, "Invalid JSON")
            return

        cadastral = str(payload.get("cadastral_number", "")).strip()
        if not cadastral:
            self.send_error(HTTPStatus.BAD_REQUEST, "Missing cadastral_number")
            return

        description = payload.get("description")
        avito_link = payload.get("avito_link")

        with LOCK:
            notes = load_notes()
            entry = notes.get(cadastral, {})
            if description is not None:
                entry["description"] = description
            if avito_link is not None:
                entry["avito_link"] = avito_link
            notes[cadastral] = entry
            save_notes(notes)

        response = json.dumps({"status": "ok"}).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self._set_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response)))
        self.end_headers()
        self.wfile.write(response)

    # --- AI integration ---------------------------------------------------

    def _handle_ai_describe(self) -> None:
        if not YANDEX_GPT_ENABLED:
            self.send_error(HTTPStatus.SERVICE_UNAVAILABLE, "YandexGPT is not configured")
            return

        content_length = int(self.headers.get("Content-Length", "0"))
        if content_length <= 0:
            self.send_error(HTTPStatus.BAD_REQUEST, "Empty body")
            return

        body = self.rfile.read(content_length).decode("utf-8")
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            self.send_error(HTTPStatus.BAD_REQUEST, "Invalid JSON")
            return

        record = payload.get("record")
        if not isinstance(record, dict):
            self.send_error(HTTPStatus.BAD_REQUEST, "Field 'record' must be an object")
            return

        existing_note = payload.get("existing_note")
        instruction = payload.get("instruction")

        try:
            prompt = build_prompt(record, existing_note, instruction)
            gpt_text = call_yandex_gpt(prompt)
        except RuntimeError as error:
            payload = json.dumps(
                {
                    "error": "YandexGPT request failed",
                    "details": str(error),
                },
                ensure_ascii=False,
            ).encode("utf-8")
            self.send_response(HTTPStatus.BAD_GATEWAY)
            self._set_cors_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        response = json.dumps({"text": gpt_text}, ensure_ascii=False).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self._set_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response)))
        self.end_headers()
        self.wfile.write(response)

    def serve_static(self, path: str) -> None:
        if not PUBLIC_DIR.exists():
            self.send_error(HTTPStatus.NOT_FOUND, "Static directory missing")
            return

        requested = unquote(path.split("?", 1)[0])
        if requested == "/" or not requested:
            requested = "/index.html"

        target = (PUBLIC_DIR / requested.lstrip("/")).resolve()
        public_root = PUBLIC_DIR.resolve()

        try:
            target.relative_to(public_root)
        except ValueError:
            self.send_error(HTTPStatus.FORBIDDEN, "Access denied")
            return

        if target.is_dir():
            target = target / "index.html"

        if not target.exists():
            if not target.suffix:
                candidate = target.with_name(f"{target.name}.html")
                if candidate.exists() and candidate.is_file():
                    target = candidate
                else:
                    self.send_error(HTTPStatus.NOT_FOUND, "File not found")
                    return
            else:
                self.send_error(HTTPStatus.NOT_FOUND, "File not found")
                return

        if not target.is_file():
            self.send_error(HTTPStatus.NOT_FOUND, "File not found")
            return

        content_type, _ = mimetypes.guess_type(target.name)
        if not content_type:
            content_type = "application/octet-stream"

        data = target.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main() -> None:
    ensure_data_file()
    server_address = ("", 8080)
    httpd = ThreadingHTTPServer(server_address, NotesHandler)
    host, port = httpd.server_address
    url = f"http://localhost:{port}"
    print(f"Backend server is running at {url}")
    print("Endpoints:")
    print("  GET  /notes")
    print("  POST /notes  (JSON: cadastral_number, description?, avito_link?)")
    print("  GET  /proxy-map?query=<cad>  (границы участка через map.ru)")
    if YANDEX_GPT_ENABLED:
        print("  POST /ai/describe  (генерация текста через YandexGPT)")
        if YANDEX_GPT_SYSTEM_PROMPT:
            print("    ↳ системный промт берётся из YANDEX_GPT_SYSTEM_PROMPT")
    else:
        print("  POST /ai/describe  (недоступно — нет переменных YANDEX_GPT_API_KEY/URI)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        httpd.server_close()


if __name__ == "__main__":
    main()
