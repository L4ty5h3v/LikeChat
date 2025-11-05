# Environment Variables Example

Создайте файл `.env.local` в корне проекта со следующими переменными:

```bash
# Upstash Redis Configuration
# Получите эти значения в https://console.upstash.com/
UPSTASH_REDIS_REST_URL=https://your-database-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-rest-token-here

# Neynar API (опционально для дополнительной функциональности)
NEYNAR_API_KEY=your-neynar-api-key

# Token Contract Address
TOKEN_CONTRACT_ADDRESS=0x04D388DA70C32FC5876981097c536c51c8d3D236

# Next.js Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Как получить Upstash credentials:

1. Перейдите на [Upstash Console](https://console.upstash.com/)
2. Создайте новую базу данных
3. Скопируйте **REST URL** и **REST Token**
4. Вставьте их в `.env.local`

## Для Vercel Deploy:

Добавьте эти переменные в настройках проекта Vercel:
- Settings → Environment Variables
- Добавьте все переменные для Production, Preview, Development






