Задача: Реализация подписочной системы через Prodamus (клубный функционал)
Контекст
В проекте Uchion (ychion.ru) уже реализована разовая покупка генераций через Prodamus. Нужно добавить подписочную (рекуррентную) систему через клубный функционал Prodamus. Подписки уже созданы в панели Prodamus, клубный функционал подключён.
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
Параметры webhook подписки: https://help.prodamus.ru/payform/integracii/tekhnicheskaya-dokumentaciya-po-avtoplatezham/uvedomleniya (URL-уведомления по подпискам содержат блок subscription помимо стандартных полей)
Управление подписками через API: https://help.prodamus.ru/payform/integracii/tekhnicheskaya-dokumentaciya-po-avtoplatezham/untitled
Деактивация подписки: https://help.prodamus.ru/payform/integracii/tekhnicheskaya-dokumentaciya-po-avtoplatezham/deaktivaciya-i-povtornaya-aktivaciya-podpiski

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
PRODAMUS_SUBSCRIPTION_STARTER_ID=<ID из панели Prodamus>
PRODAMUS_SUBSCRIPTION_TEACHER_ID=<ID из панели Prodamus>  
PRODAMUS_SUBSCRIPTION_EXPERT_ID=<ID из панели Prodamus>
(Точные ID я вcтавлю в env)
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
prodamusSubscriptionId (integer) — ID подписки-продукта в Prodamus
plan (varchar) — 'starter' | 'teacher' | 'expert'
status (varchar) — 'active' | 'past_due' | 'cancelled' | 'expired'
generationsPerPeriod (integer)
currentPeriodStart (timestamp)
currentPeriodEnd (timestamp)
customerEmail (varchar)
customerPhone (varchar)
cancelledAt (timestamp, nullable)
createdAt, updatedAt (timestamps)

Важно: Не ломать существующую логику разовых покупок — она должна продолжать работать параллельно.
3. Backend: Создание ссылки на подписку
Новый endpoint POST /api/billing/create-subscription-link:
Логика:

Принять { plan: 'starter' | 'teacher' | 'expert' } от клиента
Проверить что пользователь авторизован (withAuth)
Проверить что у пользователя нет уже активной подписки (нельзя оформить вторую)
Сформировать запрос к Prodamus с параметром subscription (ID подписки) вместо products
Передать сквозные параметры: _param_userId, _param_plan — чтобы в webhook их получить
Передать customer_email пользователя
Передать urlSuccess и urlReturn
Подписать запрос через HMAC-SHA256 (существующая логика подписи в server/lib/prodamus.ts)
Отправить GET/POST запрос на PRODAMUS_PAYFORM_URL с do=link чтобы получить короткую ссылку
Вернуть ссылку клиенту

Rate limit: 10/min per user (как у create-link)
Формирование подписи: Использовать ту же библиотеку Hmac что уже используется для разовых платежей. Алгоритм: значения к строкам → сортировка по ключам → JSON → экранирование / → HMAC-SHA256 секретным ключом.
4. Backend: Обработка webhook подписки
Расширить существующий POST /api/billing/webhook (или создать отдельный POST /api/billing/subscription-webhook).
Webhook от Prodamus для подписок отличается наличием блока subscription в теле запроса. Поля блока subscription:

subscription.id — ID подписки
subscription.status — 'active' | 'non-active'
subscription.date_next_payment — дата следующего платежа
subscription.payment_init — кто инициировал: 'user' (первый платёж) или 'auto' (автосписание)

Типы событий (определять по комбинации полей):

Первый успешный платёж (payment_status=success + subscription.payment_init=user):

Создать запись в таблице subscriptions
Обновить users.subscriptionPlan = план
Установить users.generationsLeft = лимит плана
Отправить Telegram-алерт админу


Успешное автопродление (payment_status=success + subscription.payment_init=auto):

Обновить subscriptions: новый период, статус active
Сбросить users.generationsLeft = лимит плана (начисление на новый месяц)
Отправить Telegram-алерт


Неудачное автосписание (payment_status != success):

Обновить subscriptions.status = 'past_due'
НЕ обнулять генерации сразу (grace period пока Prodamus пытается повторить)
Отправить Telegram-алерт


Завершение подписки (subscription.status = 'non-active', финальное уведомление):

Обновить subscriptions.status = 'expired'
Обновить users.subscriptionPlan = 'free'
Обновить users.generationsLeft = 0
Пользователь полностью на free тарифе — 0 генераций, бесплатная модель
Отправить Telegram-алерт



Безопасность webhook (КРИТИЧНО):

Проверка подписи HMAC-SHA256 (заголовок Sign) — точно так же как для обычных платежей
Idempotency через таблицу webhook_events (eventKey + rawPayloadHash) — НЕ обрабатывать повторные
Проверка что _param_userId существует в БД
Rate limiting на endpoint
Логирование всех событий
Возвращать 200 при успехе, иначе Prodamus будет повторять запрос

5. Backend: Отмена подписки
Новый endpoint POST /api/billing/cancel-subscription:
Логика:

Проверить авторизацию (withAuth)
Найти активную подписку пользователя
Вызвать API Prodamus для деактивации подписки (POST запрос на платёжную страницу с параметрами деактивации — см. документацию Prodamus по деактивации)
Обновить subscriptions.status = 'cancelled', установить cancelledAt
НЕ менять subscriptionPlan и generationsLeft сразу — подписка активна до конца оплаченного периода
Когда currentPeriodEnd наступит и Prodamus не спишет (подписка отменена), придёт webhook о завершении → тогда переключить на free

Если API деактивации Prodamus недоступен или сложен — как минимум показать пользователю ссылку/инструкцию по отмене через Prodamus напрямую.
6. Backend: Получение статуса подписки
Расширить GET /api/auth/me — добавить в ответ:
json{
  ...существующие поля,
  "subscription": {
    "plan": "starter",
    "status": "active", 
    "generationsLeft": 18,
    "generationsTotal": 25,
    "currentPeriodEnd": "2026-03-20T00:00:00Z",
    "cancelledAt": null
  }
}
7. Backend: Логика выбора модели
Обновить api/_lib/ai-models.ts — функция getGenerationModel() и аналогичные должны учитывать subscriptionPlan:

free → бесплатная модель (deepseek), без верификации
starter / teacher / expert → платная модель (gpt-4.1), с верификацией

Текущая логика isPaid должна проверять: user.subscriptionPlan !== 'free'
8. Backend: Проверка лимитов генерации
В server/routes/generate.ts при проверке generationsLeft:

Для free: работает как сейчас — generationsLeft не восстанавливается
Для подписчиков: generationsLeft обновляется при каждом продлении через webhook
Если подписка expired или cancelled (и период кончился) — 0 генераций, free модель

9. Frontend: Страница тарифов / модальное окно
Обновить BuyGenerationsModal.tsx (или создать новый компонент SubscriptionPlansModal.tsx):
UI:

3 карточки тарифов в ряд: Начинающий (390₽), Методист (890₽), Эксперт (1690₽)
Каждая карточка: название, цена/мес, кол-во генераций, кнопка «Оформить»
Текущий план подсвечен / кнопка «Текущий план»
Если есть активная подписка — показать «Ваш план: Методист, следующее списание: 20 марта»
Кнопка «Отменить подписку» (внизу, неприметная, с подтверждением)
Сохранить существующую вкладку/секцию с разовой покупкой пакетов генераций

Логика кнопки «Оформить»:

POST /api/billing/create-subscription-link с { plan: 'starter' }
Получить URL
window.location.href = url (редирект на страницу оплаты Prodamus)

10. Frontend: Dashboard
В DashboardPage.tsx обновить секцию подписки:

Показать текущий план (free / starter / teacher / expert)
Показать generationsLeft из generationsTotal
Для подписчиков: дата следующего продления
Если past_due: баннер «Проблема с оплатой. Обновите платёжные данные»
Если cancelled: «Подписка отменена. Активна до {дата}»
Кнопка «Сменить тариф» / «Оформить подписку»

11. Frontend: Header
В компоненте Header.tsx:

Показывать бейдж текущего плана рядом с именем или в меню (например «PRO» для платных)
Показать оставшиеся генерации

Важные требования
Безопасность

Webhook подпись: ОБЯЗАТЕЛЬНО проверять HMAC-SHA256 подпись в заголовке Sign. Без валидной подписи — отклонять (403)
Idempotency: Дублирование webhook-ов не должно приводить к повторному начислению генераций. Использовать таблицу webhook_events
Атомарные операции: Обновление generationsLeft и subscriptionPlan — в одной транзакции
Не доверять клиенту: План определяется по ID подписки из webhook, а не по параметрам от клиента
Rate limiting: На все новые endpoints
Audit logging: Логировать все события подписки

Совместимость

Разовые покупки генераций должны продолжать работать параллельно с подписками
Если пользователь с подпиской докупил разовый пакет — генерации суммируются
Существующие пользователи с generationsLeft > 0 не должны потерять генерации
Все существующие endpoints должны продолжать работать

Grace Period при неоплате

При неудачном автосписании: статус past_due, доступ сохраняется
Prodamus сам повторяет попытки (настроено: 5 попыток, каждые 24ч)
Только после финального уведомления о завершении подписки → переключение на free с 0 генерациями

Отмена подписки

Подписка работает до конца оплаченного периода
После окончания периода → free, 0 генераций, бесплатная модель
Платные генерации, купленные отдельно (разово) — НЕ сгорают при отмене подписки

Формат ссылки на подписку (Prodamus API)
Для подписки вместо products передаётся параметр subscription с ID:
GET https://teacheril.payform.ru//?subscription=123&customer_email=user@mail.ru&do=link&urlSuccess=https://ychion.ru/payment/success&urlReturn=https://ychion.ru/payment/cancel&_param_userId=uuid&_param_plan=starter&signature=...
Ответ: короткая ссылка вида https://teacheril.payform.ru/
Подпись формируется так же как для обычных платежей — HMAC-SHA256 от JSON данных секретным ключом.
Порядок реализации

Конфигурация планов (shared/plans.ts)
Миграция БД (новая таблица subscriptions, поле subscriptionPlan в users)
Backend: endpoint создания ссылки подписки
Backend: обработчик webhook подписки (расширение существующего)
Backend: endpoint отмены подписки
Backend: расширение /api/auth/me с данными подписки
Backend: обновление логики выбора модели (isPaid)
Frontend: компонент выбора тарифа
Frontend: обновление Dashboard и Header
Тесты

НЕ делать

Не менять логику разовых покупок
Не удалять существующие endpoints
Не хардкодить ID подписок — брать из env
Не менять существующую схему аутентификации