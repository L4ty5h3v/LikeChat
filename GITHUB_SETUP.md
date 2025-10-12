# 🚀 Инструкция по загрузке проекта на GitHub

## Шаг 1: Установка Git

### Для Windows:

1. **Скачайте Git:**
   - Перейдите на [git-scm.com](https://git-scm.com/download/win)
   - Скачайте установщик
   - Запустите установщик и следуйте инструкциям

2. **Проверьте установку:**
   ```bash
   git --version
   ```

## Шаг 2: Настройка Git

Откройте терминал и выполните:

```bash
# Установите ваше имя
git config --global user.name "Ваше Имя"

# Установите ваш email
git config --global user.email "your.email@example.com"
```

## Шаг 3: Инициализация репозитория

В папке проекта `C:\Users\Савиных\likechat-farcaster`:

```bash
# Инициализируйте Git репозиторий
git init

# Добавьте все файлы
git add .

# Сделайте первый коммит
git commit -m "Initial commit: LikeChat project with Upstash Redis integration"
```

## Шаг 4: Создание репозитория на GitHub

1. **Перейдите на [github.com](https://github.com)**
2. **Нажмите "+" в правом верхнем углу → "New repository"**
3. **Заполните данные:**
   - **Repository name**: `likechat-farcaster`
   - **Description**: `LikeChat: Взаимная любовь от Миссис Крипто 💌`
   - **Visibility**: Public (или Private)
   - **НЕ создавайте** README, .gitignore, license (у нас уже есть)
4. **Нажмите "Create repository"**

## Шаг 5: Загрузка кода на GitHub

После создания репозитория GitHub покажет команды. Выполните:

```bash
# Добавьте удаленный репозиторий (замените YOUR_USERNAME на ваш логин)
git remote add origin https://github.com/YOUR_USERNAME/likechat-farcaster.git

# Переименуйте ветку в main (если нужно)
git branch -M main

# Загрузите код
git push -u origin main
```

### Альтернативный способ (с SSH):

Если у вас настроен SSH ключ:

```bash
git remote add origin git@github.com:YOUR_USERNAME/likechat-farcaster.git
git branch -M main
git push -u origin main
```

## Шаг 6: Проверка

1. Обновите страницу вашего репозитория на GitHub
2. Вы должны увидеть все файлы проекта

## Готовые команды (скопируйте и замените YOUR_USERNAME):

```bash
cd C:\Users\Савиных\likechat-farcaster
git init
git add .
git commit -m "Initial commit: LikeChat project with Upstash Redis integration"
git remote add origin https://github.com/YOUR_USERNAME/likechat-farcaster.git
git branch -M main
git push -u origin main
```

## Что будет загружено:

✅ Все исходные файлы проекта
✅ Компоненты (components/)
✅ Страницы (pages/)
✅ Библиотеки (lib/)
✅ Стили (styles/)
✅ Конфигурационные файлы
✅ Документация (README.md, инструкции)
✅ package.json с зависимостями

❌ НЕ будет загружено:
- node_modules/ (слишком большой, устанавливается через npm install)
- .next/ (генерируется при сборке)
- .env.local (секретные ключи)

## Последующие обновления

После первой загрузки, для обновления кода:

```bash
git add .
git commit -m "Описание изменений"
git push
```

## Деплой в Vercel из GitHub

После загрузки на GitHub:

1. Перейдите на [vercel.com](https://vercel.com)
2. Войдите через GitHub
3. Нажмите "New Project"
4. Выберите `likechat-farcaster`
5. Добавьте переменные окружения (из ENV_EXAMPLE.md)
6. Нажмите "Deploy"

🎉 **Готово!** Ваш проект на GitHub и готов к деплою!

---

## Troubleshooting

### Ошибка: "git is not recognized"
**Решение**: Перезапустите терминал после установки Git

### Ошибка: "permission denied"
**Решение**: Настройте SSH ключ или используйте Personal Access Token

### Ошибка: "remote origin already exists"
**Решение**: 
```bash
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/likechat-farcaster.git
```

### Большой размер репозитория
**Решение**: Убедитесь, что .gitignore настроен правильно и исключает node_modules/
