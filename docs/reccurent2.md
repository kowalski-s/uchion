СРОЧНО: Webhook endpoint не работает
Тестовая оплата прошла, но webhook вернул 404. Endpoint POST /api/billing/webhook не существует или не задеплоен. Это ПЕРВООЧЕРЕДНАЯ задача — без рабочего webhook подписки не будут начисляться.
Контекст
В проекте Uchion (ychion.ru) уже реализована разовая покупка генераций через Prodamus. Нужно добавить подписочную (рекуррентную) систему через клубный функционал Prodamus. Подписки уже созданы в панели Prodamus, клубный функционал подключён. Тестовый платёж прошёл успешно — данные webhook ниже.
Перед началом работы обязательно изучи:

CLAUDE.md — полное описание проекта
db/schema.ts — текущая схема БД
server/routes/billing.ts — текущая логика платежей
server/lib/prodamus.ts — хелперы Prodamus (подпись, верификация)
server/middleware/auth.ts — middleware авторизации
server/middleware/error-handler.ts — обработка ошибок (ApiError)
shared/types.ts — общие типы
src/components/BuyGenerationsModal.tsx — текущий UI покупки
src/pages/DashboardPage.tsx — личный кабинет
src/lib/api.ts — API клиент

Также изучи документацию Prodamus по подпискам:

Формирование ссылки на подписку: https://help.prodamus.ru/payform/integracii/rest-api/instrukcii-dlya-samostoyatelnaya-integracii-servisov
Техническая документация по автоплатежам: https://help.prodamus.ru/payform/integracii/tekhnicheskaya-dokumentaciya-po-avtoplatezham/formirovanie-ssylki-na-oplatu
Управление клубным функционалом: https://help.prodamus.ru/payform/integracii/tekhnicheskaya-dokumentaciya-po-avtoplatezham/untitled
Деактивация подписки: https://help.prodamus.ru/payform/integracii/tekhnicheskaya-dokumentaciya-po-avtoplatezham/deaktivaciya-i-povtornaya-aktivaciya-podpiski

РЕАЛЬНАЯ структура webhook от Prodamus (из тестового платежа)
Это РЕАЛЬНЫЙ запрос, который пришёл от Prodamus при тестовой оплате подписки. Используй эту структуру для реализации обработчика:
Заголовки запроса:
json{
  "Sign": "Sign: 3c1aac42eae371125c76dc3227852c888cec13675a93844a4ebfaa8e3262ac0c",
  "0": "Content-type: application/json"
}
ВАЖНО: Подпись приходит в заголовке Sign в формате "Sign: <hash>" — нужно извлечь хеш после "Sign: ".
Тело запроса (JSON):
json{
  "date": "2026-02-20T14:34:04+03:00",
  "order_id": "41730938",
  "order_num": "Екатерина Ильинична Х",
  "domain": "teacheril.payform.ru",
  "sum": "50.00",
  "currency": "rub",
  "customer_phone": "+79685000756",
  "customer_email": "katipri@mail.ru",
  "customer_extra": "",
  "payment_type": "Оплата картой, выпущенной в РФ",
  "commission": "3.8",
  "commission_sum": "1.90",
  "attempt": "1",
  "callbackType": "json",
  "_param_userId": "d03d02fe-21dc-4d72-b475-f7740d64c2ce",
  "_param_plan": "starter",
  "products": [
    {
      "name": "Услуга в области дополнительного образования детей и взрослых по подписке, 30 дней",
      "price": "50.00",
      "quantity": "1",
      "sum": "50.00"
    }
  ],
  "subscription": {
    "id": "2764195",
    "profile_id": "363350",
    "demo": "0",
    "active_manager": "1",
    "active_manager_date": "",
    "active_user": "1",
    "active_user_date": "",
    "cost": "50.00",
    "currency": "rub",
    "name": "Услуга в области дополнительного образования детей и взрослых по подписке, 30 дней",
    "limit_autopayments": "",
    "autopayments_num": "0",
    "first_payment_discount": "0.00",
    "next_payment_discount": "0.00",
    "next_payment_discount_num": "",
    "date_create": "2026-02-20 14:33:21",
    "date_first_payment": "2026-02-20 14:33:21",
    "date_last_payment": "2026-02-20 14:33:21",
    "date_next_payment": "2026-03-22 14:33:21",
    "date_next_payment_discount": "2026-02-20 14:33:21",
    "date_completion": "",
    "payment_num": "1",
    "notification": "0",
    "process_started_at": "",
    "autopayment": 0
  },
  "maskedPan": "427638******4079",
  "payment_status": "success",
  "payment_status_description": "Успешная оплата",
  "payment_init": "manual"
}
Ключевые поля для обработки:

payment_status — "success" = оплата прошла
_param_userId — UUID пользователя (сквозной параметр, переданный при создании ссылки)
_param_plan — план подписки (сквозной параметр)
subscription.id — ID подписки в Prodamus (например "2764195")
subscription.profile_id — ID профиля подписчика ("363350")
subscription.date_next_payment — дата следующего автосписания
subscription.autopayment — 0 = первый платёж (ручной), 1 = автосписание
subscription.payment_num — номер платежа по подписке (1 = первый)
subscription.active_user — "1" = подписка активна у пользователя
customer_email — email плательщика
order_id — ID заказа в Prodamus (для idempotency)

Заголовок Sign:
Подпись приходит в заголовке Sign. Формат: "Sign: <hmac_hash>". Нужно:

Извлечь хеш из заголовка (убрать префикс "Sign: " если есть)
Проверить через HMAC-SHA256: взять тело запроса, привести значения к строкам, отсортировать по ключам, JSON, экранировать /, подписать секретным ключом
Сравнить с полученным хешем

Платёжная страница Prodamus
PRODAMUS_PAYFORM_URL=https://teacheril.payform.ru/
Тарифные планы
Бесплатный (free):
- 5 генераций ВСЕГО (не восстанавливаются, одноразовые)
- Бесплатная модель (deepseek)
- Лимит папок: 2

Начинающий (starter): 390₽/мес
- 25 генераций в месяц (обновляются при каждом продлении)
- Платная модель (gpt-4.1)
- Лимит папок: 10

Методист (teacher): 890₽/мес  
- 60 генераций в месяц
- Платная модель (gpt-4.1)
- Лимит папок: 10

Эксперт (expert): 1690₽/мес
- 120 генераций в месяц
- Платная модель (gpt-4.1)
- Лимит папок: 10
Позже в тарифы будут добавлены дополнительные фичи, поэтому конфигурация планов должна быть легко расширяемой.
ID подписок в Prodamus
Добавить в .env:
PRODAMUS_SUBSCRIPTION_STARTER_ID=<ID из панели Prodamus — вписать>
PRODAMUS_SUBSCRIPTION_TEACHER_ID=<ID из панели Prodamus — вписать>  
PRODAMUS_SUBSCRIPTION_EXPERT_ID=<ID из панели Prodamus — вписать>
Из тестового платежа видно что starter имеет subscription.id = "2764195". Остальные ID вставит владелец.
Что нужно реализовать
1. Конфигурация тарифов
Создать файл конфигурации планов (например shared/plans.ts или api/_lib/plans.ts), чтобы все лимиты и параметры были в одном месте:
typescriptexport const SUBSCRIPTION_PLANS = {
  free: {
    name: 'Бесплатный',
    price: 0,
    generationsPerPeriod: 5, // одноразовые, не восстанавливаются
    isRecurring: false,
    folders: 2,
    paidModel: false,
  },
  starter: {
    name: 'Начинающий',
    price: 390,
    generationsPerPeriod: 25,
    isRecurring: true,
    folders: 10,
    paidModel: true,
  },
  teacher: {
    name: 'Методист',
    price: 890,
    generationsPerPeriod: 60,
    isRecurring: true,
    folders: 10,
    paidModel: true,
  },
  expert: {
    name: 'Эксперт',
    price: 1690,
    generationsPerPeriod: 120,
    isRecurring: true,
    folders: 10,
    paidModel: true,
  },
} as const;
2. Изменения в БД (db/schema.ts)
Модифицировать таблицу users:

Добавить поле subscriptionPlan (varchar, default 'free') — текущий активный план

Создать таблицу subscriptions для отслеживания подписок:

id (UUID, PK)
userId (UUID, FK → users)
prodamusSubscriptionId (varchar) — ID подписки-продукта в Prodamus (например "2764195")
prodamusProfileId (varchar) — ID профиля подписчика в Prodamus (например "363350")
plan (varchar) — 'starter' | 'teacher' | 'expert'
status (varchar) — 'active' | 'past_due' | 'cancelled' | 'expired'
generationsPerPeriod (integer)
currentPeriodStart (timestamp)
currentPeriodEnd (timestamp) — из subscription.date_next_payment
customerEmail (varchar)
customerPhone (varchar)
orderId (varchar) — order_id из Prodamus для привязки
cancelledAt (timestamp, nullable)
createdAt, updatedAt (timestamps)

Важно: Не ломать существующую логику разовых покупок — она должна продолжать работать параллельно.
3. Backend: Webhook обработчик (ПРИОРИТЕТ №1)
Endpoint POST /api/billing/webhook должен обрабатывать И разовые покупки, И подписки.
Определение типа платежа: Если в теле запроса есть поле subscription — это платёж по подписке. Если нет — разовая покупка (существующая логика).
Обработка подписки:
Получен webhook →
  1. Извлечь подпись из заголовка Sign (убрать "Sign: " префикс если есть)
  2. Проверить HMAC-SHA256 подпись
  3. Проверить idempotency (order_id + hash в webhook_events)
  4. Если есть поле subscription → обработка подписки:
  
  payment_status === "success":
    subscription.autopayment === 0 (или payment_num === "1"):
      → Первый платёж: создать подписку, активировать план, начислить генерации
    subscription.autopayment === 1 (или payment_num > 1):
      → Автопродление: обновить период, начислить генерации на новый месяц
  
  payment_status !== "success":
    → Неудачное списание: поставить past_due, НЕ обнулять генерации
  
  subscription.active_user === "0" или subscription.active_manager === "0":
    → Подписка завершена/отключена: переключить на free, 0 генераций
При первом успешном платеже:
typescript// 1. Создать запись подписки
await db.insert(subscriptions).values({
  userId: body._param_userId,
  prodamusSubscriptionId: body.subscription.id,
  prodamusProfileId: body.subscription.profile_id,
  plan: body._param_plan,
  status: 'active',
  generationsPerPeriod: SUBSCRIPTION_PLANS[plan].generationsPerPeriod,
  currentPeriodStart: new Date(body.subscription.date_last_payment),
  currentPeriodEnd: new Date(body.subscription.date_next_payment),
  customerEmail: body.customer_email,
  customerPhone: body.customer_phone,
  orderId: body.order_id,
});

// 2. Обновить пользователя (в транзакции!)
await db.update(users).set({
  subscriptionPlan: plan,
  generationsLeft: SUBSCRIPTION_PLANS[plan].generationsPerPeriod,
}).where(eq(users.id, body._param_userId));
При успешном автопродлении:
typescript// Сбросить генерации на новый период
await db.update(users).set({
  generationsLeft: SUBSCRIPTION_PLANS[plan].generationsPerPeriod,
}).where(eq(users.id, userId));

// Обновить период подписки
await db.update(subscriptions).set({
  status: 'active',
  currentPeriodStart: new Date(body.subscription.date_last_payment),
  currentPeriodEnd: new Date(body.subscription.date_next_payment),
  updatedAt: new Date(),
}).where(eq(subscriptions.userId, userId));
При завершении подписки:
typescriptawait db.update(users).set({
  subscriptionPlan: 'free',
  generationsLeft: 0,
}).where(eq(users.id, userId));

await db.update(subscriptions).set({
  status: 'expired',
  updatedAt: new Date(),
}).where(eq(subscriptions.userId, userId));
Безопасность webhook (КРИТИЧНО):

Проверка подписи HMAC-SHA256 (заголовок Sign) — ОБЯЗАТЕЛЬНО
Idempotency через таблицу webhook_events (order_id + rawPayloadHash)
Проверка что _param_userId существует в БД
Все операции в транзакции
Rate limiting на endpoint
Логирование всех событий
Telegram-алерт админу при каждом событии подписки
Возвращать HTTP 200 при успехе, иначе Prodamus будет повторять

4. Backend: Создание ссылки на подписку
Endpoint POST /api/billing/create-subscription-link уже создан. Убедиться что:

Использует do: 'link' и backend сам фетчит короткую ссылку (НЕ редирект на Prodamus с do=link!)
Передаёт _param_userId и _param_plan как сквозные параметры
Передаёт customer_email пользователя
Проверяет что у пользователя нет активной подписки
Rate limit: 10/min per user

5. Backend: Отмена подписки
Новый endpoint POST /api/billing/cancel-subscription:

Проверить авторизацию (withAuth)
Найти активную подписку пользователя
Вызвать API Prodamus для деактивации (если доступен) — см. документацию по деактивации
Обновить subscriptions.status = 'cancelled', установить cancelledAt
НЕ менять subscriptionPlan и generationsLeft сразу — подписка активна до конца периода
Показать пользователю дату окончания

6. Backend: Расширение GET /api/auth/me
Добавить в ответ данные подписки:
json{
  "...существующие поля",
  "subscription": {
    "plan": "starter",
    "status": "active", 
    "generationsLeft": 18,
    "generationsTotal": 25,
    "currentPeriodEnd": "2026-03-22T14:33:21",
    "cancelledAt": null
  }
}
7. Backend: Логика выбора модели
В api/_lib/ai-models.ts обновить isPaid:

user.subscriptionPlan !== 'free' → платная модель (gpt-4.1)
user.subscriptionPlan === 'free' → бесплатная модель (deepseek)

8. Frontend: Страница тарифов
Обновить BuyGenerationsModal.tsx или создать новый компонент:

3 карточки: Начинающий (390₽), Методист (890₽), Эксперт (1690₽)
Текущий план подсвечен
Кнопка «Оформить» → POST /api/billing/create-subscription-link → редирект
Если есть подписка → показать статус и кнопку «Отменить»
Сохранить разовую покупку пакетов параллельно

9. Frontend: Dashboard и Header
Dashboard:

Текущий план (free / starter / teacher / expert)
Генерации: использовано/всего
Дата следующего продления
Если past_due: баннер «Проблема с оплатой»
Если cancelled: «Подписка отменена. Активна до {дата}»

Header:

Бейдж плана рядом с генерациями

Важные требования
Совместимость

Разовые покупки генераций ПРОДОЛЖАЮТ работать параллельно
Если подписчик докупил разовый пакет — генерации суммируются
Существующие пользователи не теряют генерации
Все существующие endpoints работают как раньше

Grace Period при неоплате

При неудачном автосписании: past_due, доступ сохраняется
Prodamus повторяет попытки (5 попыток, каждые 24ч)
После финального уведомления → free, 0 генераций

Отмена подписки

Работает до конца оплаченного периода
После → free, 0 генераций, бесплатная модель
Разово купленные генерации НЕ сгорают

Порядок реализации

ПРИОРИТЕТ: Webhook endpoint (POST /api/billing/webhook) — чтобы платежи обрабатывались
Миграция БД (subscriptions таблица, subscriptionPlan поле)
Конфигурация планов (shared/plans.ts)
Расширение /api/auth/me
Обновление isPaid логики
Endpoint отмены подписки
Frontend: тарифы, dashboard, header
Тесты

НЕ делать

Не менять логику существующих разовых покупок
Не удалять существующие endpoints
Не хардкодить ID подписок — брать из env
Не менять схему аутентификации
Не доверять данным от клиента — план определяется по subscription.id из webhook