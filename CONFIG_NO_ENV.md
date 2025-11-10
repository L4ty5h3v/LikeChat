# ⚙️ Конфигурация без использования env переменных

Все настройки теперь находятся прямо в коде в виде констант.

## 📋 Где находятся настройки:

### 1. `lib/farcaster-swap.ts`

```typescript
const TOKEN_CONTRACT_ADDRESS = '0x04d388da70c32fc5876981097c536c51c8d3d236'; // MCT Token
const USE_FARCASTER_SWAP = true; // Использовать Farcaster Swap API
const USE_USDC_FOR_PAYMENT = false; // false = ETH, true = USDC
```

### 2. `lib/web3.ts`

```typescript
const TOKEN_CONTRACT_ADDRESS = '0x04d388da70c32fc5876981097c536c51c8d3d236'; // MCT Token
const USE_FARCASTER_SWAP = true; // Использовать Farcaster Swap API
const USE_USDC_FOR_PURCHASE = false; // Использовать USDC вместо ETH
const BASE_RPC_URL = 'https://mainnet.base.org';
```

### 3. `pages/buyToken.tsx`

```typescript
const useUSDC = false; // false = ETH, true = USDC
const useFarcasterSwap = true; // Использовать Farcaster Swap API
```

---

## 🔧 Как изменить настройки:

### Изменить токен для покупки:

В `lib/farcaster-swap.ts` и `lib/web3.ts`:
```typescript
const TOKEN_CONTRACT_ADDRESS = '0xВашАдресТокена';
```

### Переключить на USDC:

В `lib/farcaster-swap.ts`:
```typescript
const USE_USDC_FOR_PAYMENT = true; // Вместо false
```

В `lib/web3.ts`:
```typescript
const USE_USDC_FOR_PURCHASE = true; // Вместо false
```

В `pages/buyToken.tsx`:
```typescript
const useUSDC = true; // Вместо false
```

### Отключить Farcaster Swap (использовать смарт-контракт):

В `lib/farcaster-swap.ts`:
```typescript
const USE_FARCASTER_SWAP = false; // Вместо true
```

В `lib/web3.ts`:
```typescript
const USE_FARCASTER_SWAP = false; // Вместо true
```

В `pages/buyToken.tsx`:
```typescript
const useFarcasterSwap = false; // Вместо true
```

---

## ✅ Текущая конфигурация:

- **Токен:** MCT (`0x04d388da70c32fc5876981097c536c51c8d3d236`)
- **Метод покупки:** Farcaster Swap API ✅
- **Валюта оплаты:** ETH
- **Сеть:** Base (8453)
- **Количество:** 0.10 MCT

---

## 🚀 Готово к использованию!

Все настройки в коде, не нужно настраивать `.env.local` для swap!

