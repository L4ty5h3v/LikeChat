# 🚀 Загрузка проекта на GitHub БЕЗ Git

## Способ 1: Через веб-интерфейс GitHub (САМЫЙ ПРОСТОЙ)

### Шаг 1: Создайте ZIP архив

1. Откройте папку проекта: `C:\Users\Савиных\likechat-farcaster`
2. Выделите ВСЕ файлы и папки (Ctrl+A)
3. Правой кнопкой → **Отправить** → **Сжатая ZIP-папка**
4. Назовите: `likechat-farcaster.zip`

### Шаг 2: Создайте репозиторий на GitHub

1. Перейдите на [github.com](https://github.com)
2. Войдите в аккаунт
3. Нажмите **"+"** → **"New repository"**
4. Заполните:
   - **Repository name**: `likechat-farcaster`
   - **Description**: `LikeChat: Взаимная любовь от Миссис Крипто 💌`
   - **Public** или **Private** (на ваш выбор)
   - **✅ Initialize this repository with a README** (поставьте галочку!)
5. Нажмите **"Create repository"**

### Шаг 3: Загрузите файлы

1. На странице вашего нового репозитория
2. Нажмите **"Add file"** → **"Upload files"**
3. Перетащите **все файлы и папки** из вашего проекта ИЛИ нажмите **"choose your files"**
4. Важно: Загружайте папки по отдельности:
   - `components/`
   - `lib/`
   - `pages/`
   - `public/`
   - `styles/`
   - `types/`
   - Все остальные файлы
5. В поле "Commit message" напишите: `Initial commit: LikeChat project`
6. Нажмите **"Commit changes"**

---

## Способ 2: Через GitHub Desktop (GUI приложение)

### Установка GitHub Desktop

1. Скачайте: [desktop.github.com](https://desktop.github.com/)
2. Установите приложение
3. Войдите в GitHub аккаунт

### Создание репозитория

1. **File** → **Add Local Repository**
2. Выберите папку: `C:\Users\Савиных\likechat-farcaster`
3. Нажмите **"Create repository"**
4. Введите описание и нажмите **"Create Repository"**
5. Нажмите **"Publish repository"**
6. Выберите имя: `likechat-farcaster`
7. Нажмите **"Publish Repository"**

**Готово!** 🎉

---

## Способ 3: Портативный Git (без установки)

Если хотите использовать Git без установки:

1. Скачайте: [Portable Git](https://git-scm.com/download/win)
2. Распакуйте в папку (например, `C:\PortableGit`)
3. Откройте `git-bash.exe`
4. Выполните команды из `GITHUB_SETUP.md`

---

## ⚠️ Важно перед загрузкой

Убедитесь, что в вашем проекте есть файл `.gitignore` (уже создан).

Он исключит из загрузки:
- ❌ `node_modules/` (слишком большой)
- ❌ `.next/` (генерируется автоматически)
- ❌ `.env.local` (секретные ключи)

---

## 🎯 После загрузки на GitHub

### Деплой в Vercel:

1. Перейдите: [vercel.com](https://vercel.com)
2. Войдите через GitHub
3. **"New Project"**
4. Выберите `likechat-farcaster`
5. Добавьте переменные окружения:
   ```
   UPSTASH_REDIS_REST_URL=https://your-url.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your-token
   TOKEN_CONTRACT_ADDRESS=0x04D388DA70C32FC5876981097c536c51c8d3D236
   ```
6. **"Deploy"**

---

## 📋 Что будет загружено

✅ Исходный код приложения
✅ Компоненты (components/)
✅ Страницы (pages/)
✅ Библиотеки (lib/)
✅ Стили (styles/)
✅ Документация
✅ package.json

❌ НЕ будет загружено:
- node_modules/ (100+ MB)
- .next/ (build cache)
- .env.local (секреты)

---

## 🔄 Обновление кода (после первой загрузки)

### Через веб-интерфейс:
1. Откройте файл на GitHub
2. Нажмите **"Edit"** (значок карандаша)
3. Внесите изменения
4. **"Commit changes"**

### Через GitHub Desktop:
1. Внесите изменения в файлы
2. GitHub Desktop автоматически покажет изменения
3. Напишите описание
4. **"Commit to main"**
5. **"Push origin"**

---

## 💡 Рекомендация

**Самый простой способ** - Способ 2 с GitHub Desktop:
- Не нужно устанавливать Git
- Удобный графический интерфейс
- Автоматическая синхронизация
- Просто перетащите файлы

**Самый быстрый** - Способ 1 через веб-интерфейс:
- Не нужно ничего устанавливать
- Работает прямо в браузере
- 5 минут и готово

---

## ❓ Вопросы?

Смотрите полные инструкции:
- `GITHUB_SETUP.md` - для Git
- `VERCEL_DEPLOY.md` - для деплоя
- `UPSTASH_SETUP.md` - для базы данных
