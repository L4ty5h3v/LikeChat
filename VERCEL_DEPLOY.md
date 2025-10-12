# 🚀 Деплой LikeChat в Vercel с Upstash Redis

## 📋 Пошаговая инструкция

### 1. Подготовка проекта

✅ **Проект уже готов!** Все файлы настроены:
- `@upstash/redis` установлен
- `lib/upstash-db.ts` создан
- `lib/db-config.ts` настроен
- Все импорты обновлены

### 2. Создание Upstash базы данных

1. **Перейдите на [Upstash Console](https://console.upstash.com/)**
2. **Войдите или создайте аккаунт**
3. **Нажмите "Create Database"**
4. **Настройте:**
   - **Name**: `likechat-redis`
   - **Region**: выберите ближайший к вашему региону
   - **Type**: Global (рекомендуется)
5. **Нажмите "Create"**

### 3. Получение credentials

После создания базы:

1. **Откройте раздел "Details"**
2. **Скопируйте:**
   - **REST URL** (`UPSTASH_REDIS_REST_URL`)
   - **REST Token** (`UPSTASH_REDIS_REST_TOKEN`)

### 4. Деплой в Vercel

#### Вариант A: Через Vercel CLI (рекомендуется)

```bash
# Установите Vercel CLI
npm i -g vercel

# Войдите в аккаунт
vercel login

# Деплой
vercel

# Добавьте переменные окружения
vercel env add UPSTASH_REDIS_REST_URL
vercel env add UPSTASH_REDIS_REST_TOKEN
vercel env add TOKEN_CONTRACT_ADDRESS

# Передеплой с переменными
vercel --prod
```

#### Вариант B: Через GitHub + Vercel Dashboard

1. **Загрузите код в GitHub**
2. **Перейдите на [Vercel Dashboard](https://vercel.com/dashboard)**
3. **Нажмите "New Project"**
4. **Импортируйте ваш GitHub репозиторий**
5. **Настройте проект:**
   - **Framework Preset**: Next.js
   - **Root Directory**: `./` (по умолчанию)
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next` (автоматически)

### 5. Настройка Environment Variables

В настройках проекта Vercel:

1. **Settings** → **Environment Variables**
2. **Добавьте переменные:**

| Name | Value | Environment |
|------|-------|-------------|
| `UPSTASH_REDIS_REST_URL` | `https://your-database-url.upstash.io` | Production, Preview, Development |
| `UPSTASH_REDIS_REST_TOKEN` | `your-rest-token-here` | Production, Preview, Development |
| `TOKEN_CONTRACT_ADDRESS` | `0x04D388DA70C32FC5876981097c536c51c8d3D236` | Production, Preview, Development |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` | Production, Preview, Development |

### 6. Тестирование

После деплоя:

1. **Откройте ваше приложение**
2. **Проверьте консоль браузера** - должно быть:
   ```
   📊 Database: UPSTASH (persistent: true)
   ✅ Using Upstash Redis for persistent storage
   ```

3. **Протестируйте функциональность:**
   - Подключение кошелька
   - Выбор активности
   - Публикация ссылок
   - Покупка токенов

### 7. Мониторинг

**Upstash Console:**
- Просмотр данных в реальном времени
- Мониторинг использования
- Статистика запросов

**Vercel Dashboard:**
- Логи приложения
- Метрики производительности
- Аналитика трафика

### 8. Troubleshooting

#### Проблема: "Database: MEMORY" в продакшене
**Решение:** Проверьте, что переменные окружения добавлены в Vercel

#### Проблема: "Redis connection failed"
**Решение:** 
1. Проверьте правильность URL и токена
2. Убедитесь, что база данных активна в Upstash

#### Проблема: Build ошибки
**Решение:**
```bash
# Очистите кэш
rm -rf .next
npm run build
```

### 9. Обновления

Для обновления приложения:

```bash
# Внесите изменения в код
git add .
git commit -m "Update app"
git push origin main

# Vercel автоматически передеплоит
```

### 10. Стоимость

**Vercel:**
- **Hobby Plan**: Бесплатно (до 100GB bandwidth)
- **Pro Plan**: $20/месяц (безлимитный bandwidth)

**Upstash:**
- **Free Tier**: 10,000 запросов/день
- **Pay-as-you-go**: $0.2 за 100,000 запросов

---

## 🎉 Готово!

Ваше приложение LikeChat теперь работает в продакшене с постоянным хранением данных в Upstash Redis!

### 🔗 Полезные ссылки:
- [Vercel Dashboard](https://vercel.com/dashboard)
- [Upstash Console](https://console.upstash.com/)
- [Next.js Deployment Docs](https://nextjs.org/docs/deployment)
