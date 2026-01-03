# NextAuth.js Integration Summary

## Что установлено

NextAuth.js успешно интегрирован в проект Uchion для работы с Vercel Functions + Drizzle ORM + Supabase PostgreSQL.

## Установленные пакеты

```json
{
  "dependencies": {
    "next-auth": "^4.x",
    "@auth/drizzle-adapter": "^1.11.1",
    "bcryptjs": "^2.x"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.x"
  }
}
```

## Структура файлов

### API Routes

```
api/
├── auth/
│   ├── [...nextauth].ts    # NextAuth catch-all route (все auth endpoints)
│   ├── register.ts          # Регистрация новых пользователей
│   └── me.ts                # Получение данных текущего пользователя
└── _lib/
    └── auth/
        ├── config.ts        # Конфигурация NextAuth
        ├── adapter.ts       # Drizzle адаптер
        ├── password.ts      # Утилиты для хеширования паролей
        ├── middleware.ts    # Middleware для защиты routes
        └── index.ts         # Экспорты
```

### Database Schema

```
db/
├── schema.ts               # Схема БД с таблицами NextAuth
└── index.ts                # Drizzle instance
```

Добавлены поля в таблицу `users`:
- `emailVerified` - дата подтверждения email
- `image` - URL аватара пользователя

### Types

```
types/
└── next-auth.d.ts          # Расширение типов NextAuth (добавлены id, role)
```

### Documentation

```
docs/
├── AUTH_SETUP.md           # Полная документация по настройке
├── AUTH_QUICKSTART.md      # Быстрый старт для разработчиков
└── AUTH_SUMMARY.md         # Этот файл
```

## Providers

Настроены три способа авторизации:

### 1. Credentials (Email/Password)
- Встроенная авторизация с хешированием паролей (bcryptjs)
- Поддержка регистрации через `/api/auth/register`
- Вход через `/api/auth/signin/credentials`

### 2. Yandex OAuth
- Требует настройки в Yandex OAuth
- Переменные: `YANDEX_CLIENT_ID`, `YANDEX_CLIENT_SECRET`
- Callback URL: `{NEXTAUTH_URL}/api/auth/callback/yandex`

## Endpoints

### Authentication

- `GET /api/auth/session` - Текущая сессия
- `POST /api/auth/signin/credentials` - Вход (Email/Password)
- `GET /api/auth/signin/yandex` - Вход через Яндекс
- `GET /api/auth/telegram/callback` - Вход через Telegram
- `POST /api/auth/signout` - Выход
- `GET /api/auth/csrf` - CSRF token
- `GET /api/auth/providers` - Список доступных providers

### Custom Endpoints

- `POST /api/auth/register` - Регистрация нового пользователя
- `GET /api/auth/me` - Получить данные текущего пользователя

## Middleware

Созданы две функции middleware для защиты API routes:

### `withAuth`
Требует аутентификации пользователя:

```typescript
import { withAuth } from './_lib/auth'

export default withAuth(async (req, res, userId) => {
  // userId доступен автоматически
  return res.json({ userId })
})
```

### `withAdminAuth`
Требует роль admin:

```typescript
import { withAdminAuth } from './_lib/auth'

export default withAdminAuth(async (req, res, userId) => {
  // Только admin может получить доступ
  return res.json({ message: 'Admin only' })
})
```

## Переменные окружения

### Обязательные (для работы auth)

```bash
DATABASE_URL=postgresql://...
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
```

### Опциональные (для OAuth)

```bash
YANDEX_CLIENT_ID=...
YANDEX_CLIENT_SECRET=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_BOT_USERNAME=...
```

## Database Migrations

Схема БД обновлена. Для применения изменений выполните:

```bash
npm run db:push
```

Это добавит поля `emailVerified` и `image` в таблицу `users`.

## Session Strategy

Используется **JWT strategy** (без database sessions):
- Сессии хранятся в JWT токенах
- Max age: 30 дней
- Включает: `id`, `email`, `role`

## Security Features

1. **Password hashing**: bcryptjs с 12 rounds
2. **CSRF protection**: Встроенная в NextAuth
3. **Secure cookies**: httpOnly, sameSite=lax
4. **JWT signing**: С использованием NEXTAUTH_SECRET
5. **Role-based access**: Поддержка ролей user/admin

## Следующие шаги

1. **Настройте OAuth providers** (см. AUTH_SETUP.md)
2. **Создайте frontend компоненты** для входа/регистрации
3. **Защитите API routes** с помощью `withAuth` / `withAdminAuth`
4. **Добавьте email-верификацию** (опционально)
5. **Реализуйте "Forgot Password"** (опционально)

## Проверка работы

### 1. Запустите проект

```bash
vercel dev
```

### 2. Зарегистрируйте пользователя

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

### 3. Войдите

Откройте `http://localhost:3000/api/auth/signin` в браузере

### 4. Проверьте сессию

```bash
curl http://localhost:3000/api/auth/session
```

## Troubleshooting

См. раздел Troubleshooting в [AUTH_SETUP.md](./AUTH_SETUP.md)

## Ссылки

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Drizzle ORM Adapter](https://authjs.dev/reference/adapter/drizzle)
- [Vercel Functions](https://vercel.com/docs/functions)
