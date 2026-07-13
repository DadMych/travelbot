# Travel Map

Личная карта путешествий: Telegram-бот для добавления мест + красивый сайт с картой и ачивками.

## Что умеет

- **Telegram-бот** — пишешь город, выбираешь из списка с деталями (страна, регион, тип), место попадает на карту
- **Сайт** — интерактивная тёмная карта (MapLibre), список мест, статистика
- **Ачивки** — за города, страны, континенты, количество поездок (иконки Lucide, без эмодзи)
- **Защита** — пароль на сайт, бот только для твоего Telegram ID

## Стек

- Next.js 16 + TypeScript
- PostgreSQL (Neon) + Drizzle ORM
- grammY (Telegram bot webhook)
- MapLibre GL + react-map-gl
- Lucide React icons
- Nominatim (OpenStreetMap) для геокодинга — бесплатно, без API-ключа

## Быстрый старт

### 1. База данных (Neon — бесплатно)

1. Зайди на [neon.tech](https://neon.tech), создай проект
2. Скопируй connection string
3. Создай `.env.local`:

```bash
cp .env.example .env.local
```

Заполни:

```env
DATABASE_URL=postgresql://...
TELEGRAM_BOT_TOKEN=123456:ABC...   # от @BotFather
TELEGRAM_OWNER_ID=123456789        # твой Telegram user ID
SITE_PASSWORD=твой_пароль          # для входа на сайт
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

**Как узнать свой Telegram ID:** напиши [@userinfobot](https://t.me/userinfobot)

### 2. Миграция БД

```bash
npm run db:push
```

### 3. Запуск локально

```bash
npm run dev
```

Сайт: [http://localhost:3000](http://localhost:3000)

### 4. Telegram webhook (локально через ngrok)

```bash
ngrok http 3000
```

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<ngrok-id>.ngrok.io/api/telegram/webhook"
```

## Деплой на Vercel

1. Запушь репо на GitHub
2. Import в [Vercel](https://vercel.com)
3. Добавь env variables из `.env.example`
4. `NEXT_PUBLIC_SITE_URL=https://твой-домен.vercel.app`
5. После деплоя — webhook:

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://твой-домен.vercel.app/api/telegram/webhook"
```

6. На Neon разреши подключения с Vercel (обычно работает из коробки)

## Как пользоваться ботом

1. `/start` — приветствие
2. Пишешь: `Barcelona` или `Тбилиси`
3. Бот показывает варианты кнопками
4. Жмёшь нужный — место на карте
5. `/stats` — статистика и ачивки

## Структура

```
src/
  app/              # Next.js pages + API
  components/       # UI (карта, ачивки, список)
  lib/
    db/             # Drizzle schema
    telegram/       # Bot handlers
    achievements.ts # Логика ачивок
    geocoding.ts    # Поиск городов
    visits.ts       # CRUD
```

## Ачивки

| Ачивка | Условие |
|--------|---------|
| Первый шаг | 1 место |
| Городской исследователь | 5 городов |
| Глобус в кармане | 10 стран |
| Пятиконтинентальный | 5 континентов |
| Легенда путешествий | 100 мест |
| ... | см. `src/lib/achievements.ts` |

Ачивки считаются автоматически из данных — ничего настраивать не нужно.
