# Scaling Plan

## 1. MVP (Текущий этап)

### Архитектура
- **Frontend**: SPA (React/Vite) на Vercel Edge.
- **Backend**: Serverless Functions.
- **AI**: Прямой вызов OpenAI (gpt-4o-mini).
- **State**: Client-side (Zustand + LocalStorage).
- **Database**: Отсутствует.

### Ограничения
- Лимиты Vercel Function Timeout (10-60 сек). Решено через SSE.
- Отсутствие истории генераций (хранится только в браузере).

---

## 2. Этап 1: Persistence & Auth (Q2 2025)

### Цель
Добавить сохранение истории и личные кабинеты.

### Изменения
1.  **Database**: Подключение Supabase (PostgreSQL).
    - Таблицы: `users`, `worksheets`, `generations_log`.
2.  **Auth**: Supabase Auth (Email/Google).
3.  **API**: Новые эндпоинты:
    - `GET /api/worksheets` (список).
    - `GET /api/worksheets/:id` (детали).

---

## 3. Этап 2: Performance & Caching (Q3 2025)

### Цель
Снизить расходы на AI и ускорить отдачу.

### Изменения
1.  **Semantic Caching**:
    - Перед генерацией ищем похожие темы в Vector Store (Pinecone/pgvector).
    - Если есть совпадение > 95%, отдаем готовый JSON без вызова LLM.
2.  **Rate Limiting**:
    - Redis (Upstash) для ограничения запросов по IP/User ID.

---

## 4. Этап 3: Advanced AI (Q4 2025)

### Цель
Повышение качества контента.

### Изменения
1.  **Custom Fine-tuning**:
    - Обучение модели на лучших сгенерированных листах (оцененных учителями).
2.  **Multi-agent System**:
    - Разделение на агентов: Методист (структура), Автор (текст), Корректор (валидация).

---

## 5. Миграция с Vercel (при необходимости)

Если Serverless станет дорогим:
1.  **Docker**: Упаковка API в контейнер.
2.  **Hosting**: Переезд на VPS (Hetzner/DigitalOcean) или Coolify.
3.  **CDN**: Cloudflare для статики.
