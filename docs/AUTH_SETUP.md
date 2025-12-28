# NextAuth.js Setup Guide

## Установка завершена

NextAuth.js настроен для работы с Vercel Functions + Drizzle ORM + Supabase PostgreSQL.

## Файлы конфигурации

- `api/_lib/auth/adapter.ts` - Drizzle адаптер для NextAuth
- `api/_lib/auth/config.ts` - Конфигурация NextAuth с providers
- `api/auth/[...nextauth].ts` - Vercel Function для обработки auth routes

## Providers

Настроены три способа авторизации:

1. **Email/Password (Credentials)** - встроенная авторизация
2. **Google OAuth** - авторизация через Google
3. **Yandex OAuth** - авторизация через Яндекс

## Переменные окружения

### Обязательные

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
```

### OAuth Providers (опциональные)

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Yandex OAuth
YANDEX_CLIENT_ID=your-yandex-client-id
YANDEX_CLIENT_SECRET=your-yandex-client-secret
```

## Настройка OAuth Providers

### Google OAuth

1. Перейдите в [Google Cloud Console](https://console.cloud.google.com/)
2. Создайте новый проект или выберите существующий
3. Включите Google+ API
4. Перейдите в "Credentials" → "Create Credentials" → "OAuth client ID"
5. Выберите "Web application"
6. Добавьте authorized redirect URIs:
   - Development: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://yourdomain.com/api/auth/callback/google`
7. Скопируйте Client ID и Client Secret в `.env`

### Yandex OAuth

1. Перейдите в [Yandex OAuth](https://oauth.yandex.ru/)
2. Создайте новое приложение
3. Выберите необходимые права доступа (минимум: email, имя)
4. Добавьте Callback URI:
   - Development: `http://localhost:3000/api/auth/callback/yandex`
   - Production: `https://yourdomain.com/api/auth/callback/yandex`
5. Скопируйте ID приложения и Пароль приложения в `.env`

## Генерация NEXTAUTH_SECRET

```bash
# Linux/Mac
openssl rand -base64 32

# Windows (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

## API Endpoints

После настройки доступны следующие endpoints:

- `POST /api/auth/signin` - Вход
- `POST /api/auth/signout` - Выход
- `GET /api/auth/session` - Получить текущую сессию
- `GET /api/auth/csrf` - CSRF token
- `GET /api/auth/providers` - Список доступных providers

### Авторизация через провайдеры

- `GET /api/auth/signin/google` - Вход через Google
- `GET /api/auth/signin/yandex` - Вход через Яндекс
- `POST /api/auth/signin/credentials` - Вход через Email/Password

## Middleware для защиты API

Используйте `withAuth` или `withAdminAuth` для защиты API routes:

```typescript
import { withAuth } from './_lib/auth'

export default withAuth(async (req, res, userId) => {
  // userId автоматически передается из сессии
  // Пользователь уже аутентифицирован

  return res.status(200).json({ message: 'Protected route', userId })
})
```

Для admin-only routes:

```typescript
import { withAdminAuth } from './_lib/auth'

export default withAdminAuth(async (req, res, userId) => {
  // Только пользователи с role='admin' могут получить доступ
  return res.status(200).json({ message: 'Admin only route' })
})
```

## Использование в коде

### Frontend (React)

Установите клиент NextAuth:

```bash
npm install next-auth
```

Используйте в компонентах:

```tsx
import { signIn, signOut, useSession } from 'next-auth/react'

function LoginButton() {
  const { data: session } = useSession()

  if (session) {
    return (
      <button onClick={() => signOut()}>
        Sign out {session.user?.email}
      </button>
    )
  }

  return <button onClick={() => signIn()}>Sign in</button>
}
```

### Backend (API)

Получение сессии в Vercel Function:

```typescript
import { getServerSession } from 'next-auth/next'
import { authOptions } from './_lib/auth/config'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // User is authenticated
  const userId = (session.user as any).id
  // ...
}
```

## Миграция базы данных

Схема БД уже содержит необходимые таблицы NextAuth:

- `users` - пользователи
- `accounts` - OAuth аккаунты
- `sessions` - сессии
- `verification_tokens` - токены верификации

Для применения миграций:

```bash
npm run db:push
```

## Безопасность

1. **НИКОГДА не коммитьте `.env`** с реальными ключами
2. **Используйте HTTPS в продакшене** для всех auth endpoints
3. **Регулярно ротируйте `NEXTAUTH_SECRET`**
4. **Проверяйте redirect URLs** в OAuth провайдерах
5. **Используйте сильные пароли** для базы данных

## Troubleshooting

### "NEXTAUTH_URL is not set"

Убедитесь, что переменная `NEXTAUTH_URL` установлена в `.env`:

```bash
NEXTAUTH_URL=http://localhost:3000
```

### "Database connection error"

Проверьте:
1. `DATABASE_URL` корректен
2. База данных доступна
3. Миграции применены (`npm run db:push`)

### OAuth redirect mismatch

Убедитесь, что redirect URIs в OAuth провайдере совпадают с:
- Development: `http://localhost:3000/api/auth/callback/{provider}`
- Production: `https://yourdomain.com/api/auth/callback/{provider}`

## Дальнейшие шаги

1. Настройте фронтенд компоненты для входа/регистрации
2. Добавьте middleware для защиты API routes
3. Реализуйте email-верификацию
4. Добавьте функционал "Забыли пароль"
5. Настройте кастомные страницы входа/регистрации
