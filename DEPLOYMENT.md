# Руководство по развертыванию ЛайкЧат

## 📋 Подготовка к развертыванию

### Шаг 1: Клонирование репозитория

\`\`\`bash
git clone <your-repo-url>
cd likechat-farcaster
\`\`\`

### Шаг 2: Установка зависимостей

\`\`\`bash
npm install
\`\`\`

### Шаг 3: Настройка Supabase

1. Создайте проект на [supabase.com](https://supabase.com)
2. Выполните SQL из файла `SUPABASE_SETUP.md`
3. Получите URL и Anon Key из настроек проекта

### Шаг 4: Настройка Neynar API

1. Зарегистрируйтесь на [neynar.com](https://neynar.com)
2. Получите API ключ
3. Сохраните его для следующего шага

### Шаг 5: Развертывание токена (опционально)

См. файл `TOKEN_CONTRACT.md` для инструкций по развертыванию смарт-контракта.

Альтернативно, можете использовать существующий токен на Base.

### Шаг 6: Настройка переменных окружения

Создайте файл \`.env.local\`:

\`\`\`env
# Neynar API
NEXT_PUBLIC_NEYNAR_API_KEY=neynar_api_key_123456789

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Web3 / Token Contract
NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS=0x1234567890abcdef1234567890abcdef12345678
NEXT_PUBLIC_CHAIN_ID=8453
NEXT_PUBLIC_TOKEN_PRICE_USD=0.1

# Farcaster
NEXT_PUBLIC_FARCASTER_APP_URL=https://warpcast.com
\`\`\`

## 🚀 Развертывание на Vercel

### Автоматическое развертывание

1. Импортируйте проект в Vercel:
   - Перейдите на [vercel.com](https://vercel.com)
   - Нажмите "New Project"
   - Выберите ваш Git репозиторий

2. Настройте переменные окружения:
   - В настройках проекта перейдите в "Environment Variables"
   - Добавьте все переменные из \`.env.local\`

3. Deploy!
   - Vercel автоматически соберет и развернет приложение

### Через CLI

\`\`\`bash
# Установка Vercel CLI
npm i -g vercel

# Логин
vercel login

# Развертывание
vercel

# Развертывание в продакшн
vercel --prod
\`\`\`

## 🌐 Другие платформы

### Netlify

1. Подключите репозиторий
2. Build command: \`npm run build\`
3. Publish directory: \`.next\`
4. Добавьте переменные окружения

### Railway

\`\`\`bash
# Установка Railway CLI
npm i -g @railway/cli

# Логин
railway login

# Инициализация
railway init

# Добавление переменных
railway variables set NEXT_PUBLIC_NEYNAR_API_KEY=xxx

# Deploy
railway up
\`\`\`

### Docker

\`\`\`dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
\`\`\`

Развертывание:

\`\`\`bash
docker build -t likechat .
docker run -p 3000:3000 --env-file .env.local likechat
\`\`\`

## ✅ Проверка развертывания

После развертывания проверьте:

1. ✅ Главная страница открывается
2. ✅ Подключение кошелька работает
3. ✅ База данных Supabase доступна
4. ✅ Neynar API отвечает
5. ✅ Смарт-контракт доступен

### Тест подключений

\`\`\`bash
# Проверка Supabase
curl -I https://your-project.supabase.co

# Проверка Neynar API
curl -H "api_key: YOUR_KEY" https://api.neynar.com/v2/farcaster/user?fid=1

# Проверка контракта (через etherscan/basescan)
\`\`\`

## 🔧 Настройка домена

### На Vercel

1. Перейдите в Settings > Domains
2. Добавьте свой домен
3. Обновите DNS записи у регистратора

### На Netlify

1. Domain settings > Add custom domain
2. Следуйте инструкциям

## 📊 Мониторинг

### Логи

- **Vercel**: Dashboard > Logs
- **Netlify**: Logs tab
- **Railway**: railway logs

### Аналитика

Добавьте Google Analytics или Vercel Analytics:

\`\`\`javascript
// pages/_app.tsx
import { Analytics } from '@vercel/analytics/react';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      <Analytics />
    </>
  );
}
\`\`\`

## 🔒 Безопасность

### Важно перед продакшеном:

1. ✅ Проверьте все переменные окружения
2. ✅ Настройте CORS правильно
3. ✅ Используйте HTTPS
4. ✅ Настройте Rate Limiting
5. ✅ Проверьте RLS политики в Supabase
6. ✅ Аудит смарт-контракта

### Rate Limiting (пример)

\`\`\`javascript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const rateLimit = new Map();

export function middleware(request: NextRequest) {
  const ip = request.ip ?? 'anonymous';
  const now = Date.now();
  const windowMs = 60000; // 1 минута
  const max = 10; // макс запросов

  if (!rateLimit.has(ip)) {
    rateLimit.set(ip, []);
  }

  const requests = rateLimit.get(ip).filter((time: number) => now - time < windowMs);
  
  if (requests.length >= max) {
    return new NextResponse('Too Many Requests', { status: 429 });
  }

  requests.push(now);
  rateLimit.set(ip, requests);

  return NextResponse.next();
}
\`\`\`

## 🐛 Отладка проблем

### Проблема: Не подключается кошелек

**Решение:**
- Проверьте, что пользователь на правильной сети (Base)
- Убедитесь, что MetaMask установлен

### Проблема: Ошибка Supabase

**Решение:**
- Проверьте URL и ключи
- Проверьте RLS политики
- Посмотрите логи в Dashboard

### Проблема: Neynar API не отвечает

**Решение:**
- Проверьте API ключ
- Проверьте лимиты запросов
- Убедитесь, что ключ активен

## 📞 Поддержка

При проблемах с развертыванием:
- Проверьте логи платформы
- Создайте issue в репозитории
- Свяжитесь с поддержкой используемого сервиса

---

Успешного развертывания! 🚀



