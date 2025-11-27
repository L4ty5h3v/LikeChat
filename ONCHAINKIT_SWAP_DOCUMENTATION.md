# OnchainKit useSwapToken - 100% Правильная Документация

## ✅ Официальные Источники

### 1. **Типы TypeScript (100% точная информация)**
```
node_modules/@coinbase/onchainkit/dist/minikit/hooks/useSwapToken.d.ts
```

**Ключевая информация:**
- `useSwapToken()` возвращает объект с методами `swapToken` и `swapTokenAsync`
- **НЕТ методов** `setTokenFrom`, `setTokenTo`, `setFromAmount` - их не существует!
- Параметры передаются напрямую в `swapTokenAsync(params)`

### 2. **Структура параметров:**
```typescript
type SwapTokenParams = {
  sellToken?: string;    // CAIP-19 format: "eip155:8453/erc20:0x..."
  buyToken?: string;     // CAIP-19 format: "eip155:8453/erc20:0x..."
  sellAmount?: string;   // В wei формате! "100000" для 0.10 USDC (6 decimals)
};
```

### 3. **Правильный формат sellAmount:**
- Для USDC (6 decimals): `"100000"` = 0.10 USDC
- Формула: `amount * 10^decimals` = `0.10 * 10^6` = `100000`
- **НЕ форматированная строка "0.1"!**

## 📚 Где искать документацию:

### 1. **GitHub репозиторий:**
- https://github.com/coinbase/onchainkit
- Ищите примеры в папке `examples/`
- Проверьте Issues и Discussions

### 2. **Официальная документация:**
- https://onchainkit.xyz/
- Раздел про MiniKit и Swap

### 3. **Discord/Сообщество:**
- Coinbase Developer Discord
- Farcaster Developer Discord
- Stack Overflow с тегами `onchainkit`, `farcaster`

### 4. **Прямо в коде:**
- `node_modules/@coinbase/onchainkit/dist/minikit/hooks/useSwapToken.d.ts` - типы
- `node_modules/@coinbase/onchainkit/dist/minikit/hooks/useSwapToken.js` - реализация

## ✅ Правильное использование:

```typescript
const swapHookResult = useSwapToken();
const { swapTokenAsync } = swapHookResult;

// Правильно: передаем параметры напрямую
await swapTokenAsync({
  sellToken: "eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  buyToken: "eip155:8453/erc20:0x04d388da70c32fc5876981097c536c51c8d3d236",
  sellAmount: "100000", // 0.10 USDC в wei (6 decimals)
});
```

## ❌ Неправильное использование (которое мы пытались):

```typescript
// ЭТИ МЕТОДЫ НЕ СУЩЕСТВУЮТ!
swapHookResult.setTokenFrom(...);  // ❌
swapHookResult.setTokenTo(...);    // ❌
swapHookResult.setFromAmount(...);  // ❌
```

## 🔍 Как проверить версию:

```bash
npm list @coinbase/onchainkit
```

Текущая версия: `^1.1.2`

## 📝 Выводы:

1. **sellAmount должен быть в wei формате** - строка с числом в минимальных единицах
2. **Нет методов для предустановки параметров** - передаем все в `swapTokenAsync`
3. **Типы в node_modules - самый надежный источник** информации

