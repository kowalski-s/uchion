# Telegram Login Fix - Пошаговая инструкция

## Проблема
На странице логина показывается ошибка "bot domain invalid" в Telegram Login Widget.

## Что было исправлено в коде

### ✅ 1. CRITICAL: Исправлен алгоритм HMAC signature verification
**Файл**: `api/auth/telegram/callback.ts`

**Было**: Использовался неправильный алгоритм для Telegram Web App
```typescript
const secretKey = crypto
  .createHmac('sha256', 'WebAppData')  // НЕПРАВИЛЬНО
  .update(botToken)
  .digest()
```

**Стало**: Используется правильный алгоритм для Telegram Login Widget
```typescript
const secretKey = crypto
  .createHash('sha256')  // ПРАВИЛЬНО для Login Widget
  .update(botToken)
  .digest()
```

### ✅ 2. HIGH: Добавлена timing-safe защита от timing attacks
**Файл**: `api/auth/telegram/callback.ts`

**Было**: Обычное сравнение строк
```typescript
if (hash !== calculatedHash) {  // Уязвимо к timing attacks
```

**Стало**: Timing-safe comparison
```typescript
const hashBuffer = Buffer.from(hash, 'hex')
const calculatedBuffer = Buffer.from(calculatedHash, 'hex')

if (hashBuffer.length !== calculatedBuffer.length ||
    !crypto.timingSafeEqual(hashBuffer, calculatedBuffer)) {  // Защищено
```

---

## Что нужно сделать ВРУЧНУЮ

### Шаг 1: Настройка BotFather (ОБЯЗАТЕЛЬНО!)

Это **главная причина** ошибки "bot domain invalid".

1. **Откройте Telegram** и найдите [@BotFather](https://t.me/BotFather)

2. **Отправьте команду**:
   ```
   /setdomain
   ```

3. **Выберите вашего бота**:
   ```
   @uchions_bot
   ```

4. **Введите домен** (БЕЗ протокола и БЕЗ слеша!):
   ```
   uchion.vercel.app
   ```

   ❌ **НЕПРАВИЛЬНО**:
   - `https://uchion.vercel.app`
   - `https://uchion.vercel.app/`
   - `http://uchion.vercel.app`

   ✅ **ПРАВИЛЬНО**:
   - `uchion.vercel.app`

5. **BotFather должен ответить**:
   ```
   Success! Domain uchion.vercel.app has been set for @uchions_bot
   ```

**Альтернативный способ**:
```
/mybots
-> Выберите @uchions_bot
-> Bot Settings
-> Domain
-> Введите: uchion.vercel.app
```

---

### Шаг 2: Исправление APP_URL в Vercel

В переменной окружения `APP_URL` есть лишний слеш в конце, который может вызывать проблемы.

1. **Откройте Vercel Dashboard**:
   https://vercel.com/inga-kowalskis-projects/uchion/settings/environment-variables

2. **Найдите переменную `APP_URL`**

3. **Измените значение**:

   **Было**:
   ```
   https://uchion.vercel.app/
   ```

   **Должно быть**:
   ```
   https://uchion.vercel.app
   ```
   (без слеша в конце!)

4. **Сохраните изменения**

---

### Шаг 3: Commit и Deploy исправлений

Исправленный код нужно задеплоить на Vercel.

**Выполните команды**:

```bash
# 1. Проверить изменения
git status

# 2. Добавить исправленный файл
git add api/auth/telegram/callback.ts

# 3. Создать коммит
git commit -m "fix: correct Telegram Login Widget HMAC algorithm and add timing-safe comparison

- Fixed CRITICAL security issue: use SHA256 instead of HMAC-WebAppData for Login Widget
- Added timing-safe comparison to prevent timing attacks
- Fixes 'bot domain invalid' error after BotFather configuration"

# 4. Push в main (автоматический deploy на Vercel)
git push origin main
```

**ИЛИ попросите Claude сделать это**:
```
Создай commit с исправлениями Telegram авторизации и запуш в main
```

---

### Шаг 4: Проверка после деплоя

1. **Дождитесь завершения деплоя** на Vercel (обычно 30-60 секунд)

2. **Откройте страницу логина**:
   https://uchion.vercel.app/login

3. **Проверьте**:
   - Виден ли Telegram Login Widget (кнопка "Войти через Telegram")
   - Нет ли ошибки "bot domain invalid"

4. **Попробуйте войти**:
   - Нажмите на кнопку Telegram
   - Авторизуйтесь в Telegram
   - Должен произойти редирект на главную страницу
   - Проверьте что вы залогинены

---

## Troubleshooting

### Проблема: "bot domain invalid" всё ещё показывается

**Решение**:
1. Проверьте правильность домена в BotFather:
   ```
   /setdomain -> @uchions_bot -> uchion.vercel.app
   ```
2. Убедитесь что домен указан **БЕЗ** `https://`
3. Очистите кеш браузера (Ctrl+Shift+R или Cmd+Shift+R)
4. Попробуйте в режиме инкогнито

### Проблема: "invalid_signature" при попытке входа

**Решение**:
1. Убедитесь что деплой завершился успешно
2. Проверьте Vercel logs:
   ```bash
   vercel logs
   ```
3. Убедитесь что `TELEGRAM_BOT_TOKEN` правильный в Vercel env

### Проблема: После входа не редиректит на главную

**Решение**:
1. Проверьте что `APP_URL` в Vercel БЕЗ слеша в конце
2. Проверьте Vercel logs на ошибки

---

## Резюме изменений

| Что исправлено | Критичность | Статус |
|----------------|-------------|---------|
| HMAC algorithm (SHA256 vs HMAC-WebAppData) | CRITICAL | ✅ Исправлено в коде |
| Timing-safe comparison | HIGH | ✅ Исправлено в коде |
| BotFather domain configuration | HIGH | ⏳ Требует ручной настройки |
| APP_URL trailing slash | MEDIUM | ⏳ Требует ручной настройки |

---

## Следующие шаги (опционально, для production hardening)

### 1. Улучшить rate limiting (рекомендуется для продакшена)

Текущий in-memory rate limiter сбрасывается при каждом cold start serverless функции.

**Рекомендация**: Использовать Upstash Redis или Vercel KV для distributed rate limiting.

### 2. Добавить CSP headers

Для дополнительной защиты от XSS можно добавить Content-Security-Policy:
```typescript
res.setHeader('Content-Security-Policy',
  "script-src 'self' https://telegram.org; frame-src https://oauth.telegram.org"
)
```

---

## Поддержка

Если проблемы остаются после выполнения всех шагов:

1. **Проверьте Vercel logs**:
   ```bash
   vercel logs --follow
   ```

2. **Проверьте переменные окружения**:
   ```bash
   vercel env ls
   ```

3. **Проверьте что deployment успешен**:
   https://vercel.com/inga-kowalskis-projects/uchion/deployments

---

**Дата создания**: 2026-01-04
**Версия**: 1.0
