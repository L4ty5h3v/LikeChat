# 🚀 Быстрая загрузка на GitHub

## ⚡ Самый быстрый способ

### 1. Установите Git (если еще не установлен)

Скачайте и установите: https://git-scm.com/download/win

### 2. Запустите готовый скрипт

Дважды кликните на файл:
```
git-commands.bat
```

Скрипт автоматически:
- Инициализирует Git
- Добавит все файлы
- Создаст первый коммит

### 3. Создайте репозиторий на GitHub

1. Перейдите: https://github.com/new
2. Название: `likechat-farcaster`
3. Описание: `LikeChat: Взаимная любовь от Миссис Крипто 💌`
4. Public или Private (на ваш выбор)
5. **НЕ** ставьте галочки "Add README", "Add .gitignore"
6. Нажмите "Create repository"

### 4. Загрузите код

После создания репозитория GitHub покажет команды. 

Откройте PowerShell в папке проекта и выполните (замените `ВАШ_ЛОГИН`):

```bash
git remote add origin https://github.com/ВАШ_ЛОГИН/likechat-farcaster.git
git branch -M main
git push -u origin main
```

## 🎉 Готово!

Ваш проект теперь на GitHub!

## 📦 Что дальше?

### Деплой в Vercel

1. Перейдите: https://vercel.com
2. Войдите через GitHub
3. "New Project" → выберите `likechat-farcaster`
4. Добавьте переменные окружения:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `TOKEN_CONTRACT_ADDRESS`
5. "Deploy"

### Настройка Upstash

1. Создайте базу: https://console.upstash.com/
2. Скопируйте REST URL и Token
3. Добавьте в Vercel Environment Variables

---

## 📚 Подробные инструкции

- **Полная инструкция GitHub**: `GITHUB_SETUP.md`
- **Настройка Upstash**: `UPSTASH_SETUP.md`
- **Деплой в Vercel**: `VERCEL_DEPLOY.md`
- **Переменные окружения**: `ENV_EXAMPLE.md`

---

## ❓ Проблемы?

### Git не найден
```bash
# Проверьте установку
git --version

# Если не работает - перезапустите терминал после установки Git
```

### Ошибка при push
```bash
# Убедитесь, что вы вошли в GitHub
# Или используйте Personal Access Token вместо пароля
```

### Файлы не загружаются
```bash
# Проверьте .gitignore
# Убедитесь, что нужные файлы не исключены
```

---

## 🔄 Обновление кода на GitHub

После первой загрузки, для обновлений:

```bash
git add .
git commit -m "Описание изменений"
git push
```

---

## 📞 Полезные ссылки

- **GitHub**: https://github.com
- **Vercel**: https://vercel.com
- **Upstash**: https://console.upstash.com
- **Git документация**: https://git-scm.com/doc
