# Surma Altai Catalog

Бета-версия каталога земельных участков Surma Altai. Приложение развёрнуто на сервере и доступно по адресу:

- http://surma.su/

## Содержимое репозитория
- `AGENTS.md` — руководство для команды/агентов.
- `sample/` — обрезанный пример backend + frontend без приватных данных (можно запустить локально).

## Быстрый запуск примера
```bash
cd sample/backend
python3 server.py
```
Откройте http://localhost:8080/

## Продакшен-инфраструктура (кратко)
- user-level systemd unit: `surma_altai.service`
- nginx на `surma.su` проксирует на `127.0.0.1:8080`
- YandexGPT включается через `gpt5-pro.env`
