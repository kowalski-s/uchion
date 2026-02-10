# UX / UI Guidelines

## 1. Philosophy

- **Audience**: Учителя и преподаватели (1-11 классы)
- **Principles**:
  - **Минимализм**: фокус на форме генерации
  - **Прозрачность**: прогресс 0-100% всегда виден
  - **Скорость**: результат максимально быстро
  - **Доступность**: WCAG AA совместимость

---

## 2. Color Palette

- **Primary**: Indigo-600 (`#4f46e5`)
- **Background**: White / Slate-50 (`#f8fafc`)
- **Text**: Slate-900 (основной), Slate-500 (второстепенный)
- **Error**: Rose-500 (`#f43f5e`)
- **Success**: Emerald-500 (`#10b981`)

---

## 3. Pages

### 3.1 Main (`/`) -- GeneratePage
Dual-mode страница (листы + презентации):
1. **Tabs**: Рабочие листы / Презентации
2. **Worksheet Form**:
   - Предмет: Select (Математика, Алгебра, Геометрия, Русский)
   - Класс: Select (1-11, фильтруется по предмету)
   - Тема: Input (3-200 символов)
   - Тип заданий: Multi-select (single_choice, multiple_choice, open_question, matching, fill_blank)
   - Сложность: Select (easy / medium / hard)
   - Формат: Select (test_and_open / open_only / test_only)
   - Вариант: Select (количество заданий)
   - CTA: "Сгенерировать"
3. **Presentation Form** (переключение на вкладку Презентации):
   - Предмет, Класс, Тема
   - Тема оформления: 4 пресета (professional, educational, minimal, scientific) или custom
   - Количество слайдов: 12 / 18 / 24
4. **Loading**: прогресс-бар с этапами (SSE streaming)

### 3.2 Presentation Generation (`/presentations/generate`) -- GeneratePresentationPage
Выделенная страница для презентаций:
1. Форма: предмет, класс, тема, тема оформления, количество слайдов
2. Превью слайдов: интерактивный HTML-рендер (SlidePreview компонент)
3. Download: PPTX + PDF кнопки
4. 4 визуальных темы оформления с уникальными цветовыми схемами

### 3.3 Worksheet Page (`/worksheet/:sessionId`)
Session-based (не сохранён в БД):
1. Header + "Скачать PDF"
2. Preview: HTML-рендер листа (все 5 типов заданий)
3. Inline editing: редактирование текста заданий прямо на странице
4. Task regeneration: перегенерация отдельного задания
5. Математические формулы через KaTeX
6. Actions: "Перегенерировать задание", "Создать новый"
7. UnsavedChangesDialog при уходе со страницы

### 3.4 Saved Worksheet (`/worksheets/:id`) -- SavedWorksheetPage
DB-backed лист (идентичный функционал + сохранение):
1. Все функции WorksheetPage
2. Custom title (переименование)
3. Save/Discard changes flow
4. Persistent PDF storage

### 3.5 Dashboard (`/dashboard`)
- Статистика пользователя
- Лимиты генераций (сколько осталось)
- Статус подписки
- Ссылки на списки листов

### 3.6 Worksheets List (`/worksheets`)
- Список сохраненных листов
- Организация по папкам (вложенные, цветные)
- CRUD операции с папками (лимиты по подписке: free=2, basic/premium=10)
- Grid/list view
- Bulk operations

### 3.7 Login (`/login`)
- Вход через Яндекс (OAuth)
- Вход через Telegram Widget
- Redirect handling

### 3.8 Payment pages
- `/payment/success` -- успешная оплата (PaymentSuccessPage)
- `/payment/cancel` -- отмена оплаты (PaymentCancelPage)

### 3.9 Telegram Callback (`/auth/telegram/callback`)
- Обработка OAuth callback от Telegram

### 3.10 Admin Panel (`/admin/*`)
Доступен только для пользователей с ролью `admin`:
- `/admin` -- обзор статистики (AdminPage)
- `/admin/users` -- список пользователей (AdminUsersPage)
- `/admin/users/:id` -- детали пользователя с историей генераций (AdminUserDetailPage)
- `/admin/generations` -- мониторинг генераций (AdminGenerationsPage)
- `/admin/payments` -- отслеживание платежей (AdminPaymentsPage)

---

## 4. Components

### Основные
- **Header** -- навигация с auth state
- **EditableWorksheetContent** -- рендер и inline-редактирование всех 5 типов заданий
- **MathRenderer** -- KaTeX рендеринг формул
- **SlidePreview** -- HTML preview презентаций (4 темы оформления)
- **WorksheetManager** -- save/load/delete логика
- **EditModeToolbar** -- панель управления в режиме редактирования

### UI
- **Button**: Default, Outline, Ghost
- **Input / Select**: Tailwind + Headless UI
- **CustomSelect** -- кастомный dropdown
- **Card**: группировка блоков заданий
- **Progress**: статус генерации
- **BuyGenerationsModal** -- модальное окно покупки генераций
- **UnsavedChangesDialog** -- подтверждение при уходе
- **CookieConsent** -- баннер согласия на cookies

---

## 5. Accessibility

- Все поля формы имеют `label`
- Контрастность WCAG AA
- Keyboard navigation
- ARIA-атрибуты для динамических элементов
- Screen reader поддержка для форм
