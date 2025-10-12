# Upstash Redis Setup для LikeChat

## 🚀 Настройка Upstash Redis для продакшена

### 1. Создание Upstash Database

1. Перейдите на [Upstash Console](https://console.upstash.com/)
2. Войдите или создайте аккаунт
3. Нажмите **"Create Database"**
4. Выберите регион (рекомендуется тот же, где будет деплоиться приложение)
5. Назовите базу данных: `likechat-redis`
6. Нажмите **"Create"**

### 2. Получение Credentials

После создания базы данных:

1. Перейдите в раздел **"Details"** вашей базы данных
2. Скопируйте:
   - **REST URL** (`UPSTASH_REDIS_REST_URL`)
   - **REST Token** (`UPSTASH_REDIS_REST_TOKEN`)

### 3. Настройка Environment Variables

#### Для локальной разработки (.env.local):

```bash
# Upstash Redis Configuration
UPSTASH_REDIS_REST_URL=https://your-database-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-rest-token-here
```

#### Для Vercel Deploy:

1. Перейдите в ваш проект на [Vercel Dashboard](https://vercel.com/dashboard)
2. Откройте **Settings** → **Environment Variables**
3. Добавьте переменные:

| Name | Value | Environment |
|------|-------|-------------|
| `UPSTASH_REDIS_REST_URL` | `https://your-database-url.upstash.io` | Production, Preview, Development |
| `UPSTASH_REDIS_REST_TOKEN` | `your-rest-token-here` | Production, Preview, Development |

### 4. Проверка работы

После настройки переменных окружения:

1. Перезапустите сервер разработки:
   ```bash
   npm run dev
   ```

2. В консоли должно появиться:
   ```
   📊 Database: UPSTASH (persistent: true)
   ✅ Using Upstash Redis for persistent storage
   ```

3. Если переменные не настроены, будет использоваться in-memory база:
   ```
   📊 Database: MEMORY (persistent: false)
   ⚠️  Using IN-MEMORY database. Data will be lost on restart!
   ```

### 5. Структура данных в Redis

Приложение использует следующие ключи в Redis:

- `likechat:links` - список всех ссылок (Redis List)
- `likechat:user_progress` - прогресс пользователей (Redis Hash)
- `likechat:total_links_count` - общий счетчик ссылок (Redis String)

### 6. Мониторинг и отладка

1. **Upstash Console**: Просмотр данных, мониторинг использования
2. **Vercel Logs**: Логи приложения и ошибки
3. **Redis CLI**: Прямое подключение к базе данных

### 7. Лимиты и цены

- **Free Tier**: 10,000 запросов в день
- **Pro Tier**: $0.2 за 100,000 запросов
- **Storage**: 256MB на бесплатном плане

### 8. Безопасность

- ✅ REST Token имеет ограниченные права доступа
- ✅ Все данные шифруются в транзите (HTTPS)
- ✅ Автоматические бэкапы
- ✅ Географическое распределение

### 9. Troubleshooting

#### Проблема: "Redis not available"
**Решение**: Проверьте правильность URL и токена

#### Проблема: "Failed to load Upstash Redis"
**Решение**: Убедитесь, что пакет `@upstash/redis` установлен

#### Проблема: Данные не сохраняются
**Решение**: Проверьте, что переменные окружения установлены в Vercel

### 10. Миграция данных

Если у вас уже есть данные в in-memory базе, они будут потеряны при переходе на Upstash. Для сохранения данных:

1. Экспортируйте данные из in-memory базы
2. Импортируйте в Upstash через Redis CLI или скрипт

---

## 🎯 Готово!

После настройки ваше приложение будет использовать Upstash Redis для постоянного хранения данных в продакшене, а локально - in-memory базу для быстрой разработки.
