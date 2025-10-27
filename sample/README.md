# Surma Altai (trimmed demo)

Этот каталог показывает структуру локального приложения без рабочих данных.

```
sample/
  backend/
    server.py          # HTTP API и статика
    data/notes.json    # пример заметки
    public/
      index.html       # интерфейс каталога
      script.js        # логика фильтров
      styles.css       # оформление
      all_regions.csv  # сокращённый CSV
```

Для локального просмотра:

```bash
cd sample/backend
python3 server.py
```

После запуска откройте `http://localhost:8080/`.
