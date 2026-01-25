# Инструкция по добавлению закрепленной ссылки

## Текущая ситуация
Vercel блокирует прямые API запросы через Security Checkpoint. 

## Решение 1: Через Vercel Dashboard (рекомендуется)

1. Откройте https://vercel.com/dashboard
2. Найдите проект `likechat-base-app`
3. Перейдите в раздел **Functions** или **Deployments**
4. Найдите последний деплой и откройте его
5. В логах проверьте, что API endpoint `/api/pin-link` задеплоен

## Решение 2: Через API после прохождения Security Checkpoint

Подождите 5-10 минут после деплоя, затем выполните:

```bash
node scripts/add-link-now.mjs
```

Или через curl (после прохождения проверки в браузере):

```bash
curl -X POST https://likechat-base-app.vercel.app/api/pin-link \
  -H "Content-Type: application/json" \
  -d '{
    "tokenAddress": "0xbe705864202df9a6c7c57993fde1865ae67825ce",
    "position": 5
  }'
```

## Решение 3: Напрямую через базу данных

Если у вас есть учетные данные Upstash Redis в `.env.local`:

```bash
# Убедитесь, что в .env.local есть:
# UPSTASH_REDIS_REST_URL=your_url
# UPSTASH_REDIS_REST_TOKEN=your_token

node scripts/pin-link-direct.mjs
```

## Решение 4: Через браузер (после авторизации)

1. Откройте https://likechat-base-app.vercel.app в браузере
2. Пройдите Security Checkpoint (если требуется)
3. Откройте консоль браузера (F12)
4. Выполните:

```javascript
fetch('https://likechat-base-app.vercel.app/api/pin-link', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tokenAddress: '0xbe705864202df9a6c7c57993fde1865ae67825ce',
    position: 5
  })
}).then(r => r.json()).then(console.log)
```

## Проверка результата

После добавления ссылки:
1. Откройте https://likechat-base-app.vercel.app/tasks
2. Проверьте, что ссылка с адресом `0xbe705864202df9a6c7c57993fde1865ae67825ce` находится на 5-й позиции
3. Ссылка должна быть закреплена и оставаться там навсегда
