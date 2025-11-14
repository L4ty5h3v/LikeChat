# Тестирование Farcaster Frame

## Текущий статус

Frame доступен по адресу: `https://likechat-farcaster.vercel.app/api/frame/buy-token`

## Что работает

✅ Frame метаданные правильно настроены
✅ Изображение для Frame создано (SVG)
✅ Endpoints для транзакций готовы:
   - `/api/frame/tx/eth` - покупка за ETH
   - `/api/frame/tx/usdc` - покупка за USDC (батч approve + buyTokens)

## Что нужно сделать перед тестированием

1. **Развернуть контракт MCTTokenSale на Base**
   - Используйте Remix IDE (см. `DEPLOY_CONTRACT.md`)
   - Параметры конструктора:
     - `_mctToken`: `0x04d388da70c32fc5876981097c536c51c8d3d236`
     - `_usdcToken`: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

2. **Пополнить контракт токенами MCT**
   - Переведите MCT токены на адрес контракта продажи

3. **Установить адрес контракта в Vercel**
   - Добавьте переменную окружения:
     ```
     NEXT_PUBLIC_TOKEN_SALE_CONTRACT_ADDRESS=0x...ваш_адрес_контракта
     ```
   - Или обновите в коде напрямую

4. **Установить BASE_URL (опционально)**
   - Если нужно, добавьте:
     ```
     NEXT_PUBLIC_BASE_URL=https://likechat-farcaster.vercel.app
     ```

## Как протестировать

### Вариант 1: Через Warpcast/Farcaster

1. Откройте Warpcast или Farcaster
2. Создайте новый каст со ссылкой на Frame:
   ```
   https://likechat-farcaster.vercel.app/api/frame/buy-token
   ```
3. Frame должен отобразиться с двумя кнопками:
   - "Buy MCT with ETH"
   - "Buy MCT with USDC"
4. Нажмите на кнопку
5. Подтвердите транзакцию в кошельке
6. Проверьте баланс токенов MCT

### Вариант 2: Через Frame Validator

1. Откройте [Farcaster Frame Validator](https://warpcast.com/~/developers/frames)
2. Вставьте URL: `https://likechat-farcaster.vercel.app/api/frame/buy-token`
3. Проверьте метаданные Frame
4. Протестируйте кнопки

### Вариант 3: Прямой доступ

1. Откройте в браузере: `https://likechat-farcaster.vercel.app/api/frame/buy-token`
2. Должна отобразиться HTML страница с метаданными
3. Проверьте исходный код страницы - должны быть теги `fc:frame`

## Ожидаемое поведение

### При нажатии "Buy MCT with ETH":
- Открывается окно транзакции в кошельке
- Транзакция: `buyTokensWithETH(0.10 MCT)` с `value: 0.0001 ETH`
- После подтверждения токены MCT появляются в кошельке

### При нажатии "Buy MCT with USDC":
- Открывается окно транзакции в кошельке
- Батч транзакций (EIP-5792 walletsendCalls):
  1. `approve(USDC, 0.25 USDC)` для контракта продажи
  2. `buyTokensWithUSDC(0.10 MCT)`
- После подтверждения токены MCT появляются в кошельке

## Отладка

Если Frame не работает:

1. **Проверьте метаданные:**
   ```bash
   curl https://likechat-farcaster.vercel.app/api/frame/buy-token
   ```
   Должны быть теги `fc:frame`, `fc:frame:image`, `fc:frame:button:*`

2. **Проверьте изображение:**
   ```bash
   curl https://likechat-farcaster.vercel.app/api/frame/image/buy-token
   ```
   Должен вернуться SVG

3. **Проверьте endpoints транзакций:**
   ```bash
   curl -X POST https://likechat-farcaster.vercel.app/api/frame/tx/eth
   ```
   Должен вернуться JSON с данными транзакции

4. **Проверьте консоль браузера** на наличие ошибок

5. **Проверьте логи Vercel** для ошибок сервера

## Известные проблемы

- ⚠️ Контракт еще не развернут - нужно развернуть перед тестированием
- ⚠️ Если контракт не развернут, Frame покажет предупреждение, но кнопки все равно будут работать (транзакция не пройдет)



