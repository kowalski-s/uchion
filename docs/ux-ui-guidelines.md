# UX / UI Guidelines

## 1. Philosophy

- **Audience**: Учителя и преподаватели (1-11 классы)
- **Principles**:
  - **Минимализм**: фокус на форме генерации
  - **Прозрачность**: прогресс 0-100% всегда виден
  - **Скорость**: результат максимально быстро

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
1. **Hero**: заголовок + подзаголовок
2. **Form**:
   - Предмет: Select (Математика, Алгебра, Геометрия, Русский)
   - Класс: Select (1-11, фильтруется по предмету)
   - Тема: Input (3-200 символов)
   - Тип заданий: Multi-select (single_choice, multiple_choice, open_question, matching, fill_blank)
   - Сложность: Select (easy / medium / hard)
   - Формат: Select (test_and_open / open_only / test_only)
   - Вариант: Select (количество заданий)
   - CTA: "Сгенерировать"
3. **Loading**: прогресс-бар с этапами

### 3.2 Worksheet Page (`/worksheet/:id`)
1. Header + "Скачать PDF"
2. Preview: HTML-рендер листа (задания, тест, ответы)
3. Математические формулы через KaTeX
4. Actions: "Перегенерировать", "Создать новый"

### 3.3 Dashboard (`/dashboard`)
- Статистика пользователя
- Лимиты генераций
- Статус подписки

### 3.4 Worksheets List (`/worksheets`)
- Список сохраненных листов
- Организация по папкам
- Поиск и фильтрация

### 3.5 Saved Worksheet (`/saved/:id`)
- Просмотр сохраненного листа
- Редактирование (title, content)
- Скачивание PDF

### 3.6 Login (`/login`)
- Вход через Яндекс
- Вход через Telegram Widget

### 3.7 Payment pages
- `/payment/success` -- успешная оплата
- `/payment/cancel` -- отмена оплаты

---

## 4. Components

- **Button**: Default, Outline, Ghost
- **Input / Select**: Tailwind + Headless UI
- **Card**: группировка блоков заданий
- **Progress**: статус генерации
- **Toast**: уведомления об ошибках

---

## 5. Accessibility

- Все поля формы имеют `label`
- Контрастность WCAG AA
- Keyboard navigation
- ARIA-атрибуты для динамических элементов
