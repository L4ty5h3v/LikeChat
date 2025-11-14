# Автоматическая настройка Remix

## Способ 1: Использовать конфигурационный файл

1. В Remix откройте файл `remix.config.json`
2. Скопируйте этот код и вставьте в файл:

```json
{
  "solidity-compiler": {
    "language": "Solidity",
    "compiler": "0.8.20",
    "settings": {
      "optimizer": {
        "enabled": true,
        "runs": 200
      }
    }
  }
}
```

3. Сохраните файл (Ctrl+S)
4. В панели компилятора включите чекбокс "Use configuration file"
5. Нажмите "Compile remix.config.json"

## Способ 2: Просто нажмите Compile

Remix должен автоматически определить версию из `pragma solidity ^0.8.20;`

1. Нажмите кнопку "► Compile" в верхней панели
2. Или откройте панель компилятора и нажмите "Compile MCTTokenSale.sol"

## Способ 3: Ручная настройка (если не работает)

1. Откройте панель "SOLIDITY COMPILER"
2. В разделе "COMPILER" найдите выпадающий список с версией
3. Выберите `0.8.20` или выше
4. Нажмите "Compile MCTTokenSale.sol"



