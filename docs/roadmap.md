# Roadmap

## ✅ Completed (MVP)

### Core
- [x] Monorepo структура.
- [x] Shared Layer (`shared/worksheet.ts`).
- [x] API `/api/generate` с Zod-валидацией.
- [x] AI Provider (OpenAI + Dummy).
- [x] PDF Generation (Server + Client).

### Frontend
- [x] SPA Routing (`/`, `/worksheet/:id`).
- [x] Генерация через SSE (Progress Streaming).
- [x] Просмотр и скачивание PDF.

### QA & CI
- [x] Smoke Tests (`npm run smoke`).
- [x] PDF Dump (`scripts/dump-pdf.ts`).
- [x] Vercel Deploy Config.

---

## 🚀 Q2 2025: Persistence & Accounts

- [ ] **Database**: Подключение PostgreSQL (Supabase).
- [ ] **Auth**: Регистрация/Вход (Supabase Auth).
- [ ] **History**: Сохранение сгенерированных листов.
- [ ] **Edit Mode**: Возможность редактировать задания перед печатью.

---

## 💎 Q3 2025: Monetization & Pro

- [ ] **Payments**: Интеграция Stripe/Yookassa.
- [ ] **Pro Features**:
  - Генерация > 3 листов в день.
  - Экспорт в DOCX.
  - Усложненные типы заданий (кроссворды, филворды).
- [ ] **Analytics**: Dashboard для учителя.

---

## 🧠 Q4 2025: Advanced AI

- [ ] **Fine-tuning**: Дообучение модели на качественных методичках.
- [ ] **RAG**: Загрузка учебников ФГОС в Vector Store.
- [ ] **Multi-modal**: Генерация картинок к заданиям (DALL-E 3).
