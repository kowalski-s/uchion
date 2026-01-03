# NextAuth Quick Start

## Быстрая настройка для разработки

### 1. Скопируйте переменные окружения

```bash
cp .env.example .env
```

### 2. Настройте обязательные переменные в `.env`

```bash
# Database (используйте ваш Supabase URL)
DATABASE_URL=postgresql://user:password@host:5432/database

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<сгенерируйте секрет>
```

Генерация `NEXTAUTH_SECRET`:

```bash
# Linux/Mac
openssl rand -base64 32

# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

### 3. Примените миграции базы данных

```bash
npm run db:push
```

### 4. Запустите проект

```bash
vercel dev
```

## Основные endpoints

После запуска доступны:

- `GET /api/auth/session` - текущая сессия
- `POST /api/auth/register` - регистрация нового пользователя
- `GET /api/auth/me` - информация о текущем пользователе
- `POST /api/auth/signin/credentials` - вход (Email/Password)
- `GET /api/auth/signin/yandex` - вход через Яндекс (требует настройки OAuth)
- `GET /api/auth/telegram/callback` - вход через Telegram (требует настройки бота)

## Пример регистрации

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword123",
    "name": "Test User"
  }'
```

## Пример входа

```bash
curl -X POST http://localhost:3000/api/auth/signin/credentials \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword123"
  }'
```

## Настройка OAuth (опционально)

Для работы с Яндекс OAuth и Telegram Login см. [AUTH_SETUP.md](./AUTH_SETUP.md)

## Структура файлов

```
api/
  _lib/
    auth/
      adapter.ts      # Drizzle адаптер
      config.ts       # Конфигурация NextAuth
      password.ts     # Утилиты для паролей
      index.ts        # Экспорты
  auth/
    [...nextauth].ts  # NextAuth catch-all route
    register.ts       # Регистрация
    me.ts            # Текущий пользователь
types/
  next-auth.d.ts     # Расширение типов NextAuth
```

## Проблемы?

См. раздел Troubleshooting в [AUTH_SETUP.md](./AUTH_SETUP.md)
