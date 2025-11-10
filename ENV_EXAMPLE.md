# Environment Variables Example

Создайте файл `.env.local` в корне проекта со следующими переменными:

```bash
# Upstash Redis Configuration
# Получите эти значения в https://console.upstash.com/
UPSTASH_REDIS_REST_URL=https://your-database-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-rest-token-here

# Neynar API (опционально для дополнительной функциональности)
NEYNAR_API_KEY=your-neynar-api-key

# Token Contract Address (MCT Token)
NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS=0x04d388da70c32fc5876981097c536c51c8d3d236

# Token Sale Contract Address (для покупки через ETH)
NEXT_PUBLIC_TOKEN_SALE_CONTRACT_ADDRESS=your-token-sale-contract-address

# Token Sale USDC Contract Address (для покупки через USDC)
# Если установлен, установите также NEXT_PUBLIC_USE_USDC_FOR_PURCHASE=true
NEXT_PUBLIC_TOKEN_SALE_USDC_CONTRACT_ADDRESS=your-token-sale-usdc-contract-address

# Использовать USDC для покупки (true/false)
# Если true, будет использоваться NEXT_PUBLIC_TOKEN_SALE_USDC_CONTRACT_ADDRESS
# Если false или не установлено, будет использоваться NEXT_PUBLIC_TOKEN_SALE_CONTRACT_ADDRESS
NEXT_PUBLIC_USE_USDC_FOR_PURCHASE=false

# USDC Contract Address на Base (по умолчанию: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
NEXT_PUBLIC_USDC_CONTRACT_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

# Base Network RPC URL (опционально)
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org

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






