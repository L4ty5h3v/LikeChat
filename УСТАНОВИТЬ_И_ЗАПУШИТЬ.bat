@echo off
chcp 65001 >nul
echo ========================================
echo 🚀 LikeChat - Автоматическая загрузка
echo ========================================
echo.

REM Проверка наличия Git
where git >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Git не установлен!
    echo.
    echo 📥 Устанавливаю Git через winget...
    echo.
    
    REM Попытка установить через winget
    winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
    
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo ⚠️  Автоматическая установка не удалась
        echo.
        echo 📝 Пожалуйста, установите Git вручную:
        echo    1. Скачайте: https://git-scm.com/download/win
        echo    2. Установите
        echo    3. Перезапустите этот скрипт
        echo.
        pause
        exit /b 1
    )
    
    echo.
    echo ✅ Git установлен успешно!
    echo ⚠️  ВАЖНО: Перезапустите этот скрипт
    echo.
    pause
    exit /b 0
)

echo ✅ Git обнаружен
echo.

REM Настройка Git (если еще не настроен)
git config --global user.name >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo 📝 Настройка Git...
    git config --global user.name "LikeChat Developer"
    git config --global user.email "likechat@example.com"
    echo ✅ Git настроен
    echo.
)

REM Проверка, есть ли уже репозиторий
if exist .git (
    echo 📁 Git репозиторий уже существует
    echo.
    goto :push_changes
)

echo 📝 Инициализация Git репозитория...
git init
if %ERRORLEVEL% NEQ 0 goto :error

echo ✅ Git репозиторий инициализирован
echo.

echo 📦 Добавление файлов...
git add .
if %ERRORLEVEL% NEQ 0 goto :error

echo ✅ Файлы добавлены
echo.

echo 💾 Создание коммита...
git commit -m "Initial commit: LikeChat project with Upstash Redis integration"
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  Нет изменений для коммита или коммит уже сделан
)

echo.
echo ✅ Локальный репозиторий готов!
echo.

:push_changes
echo ========================================
echo 🌐 Загрузка на GitHub
echo ========================================
echo.
echo ВАЖНО: Сейчас нужно:
echo.
echo 1. Создайте репозиторий на GitHub:
echo    https://github.com/new
echo.
echo 2. Назовите его: likechat-farcaster
echo.
echo 3. НЕ создавайте README, .gitignore, license
echo.
echo 4. После создания GitHub покажет URL репозитория
echo.
set /p GITHUB_URL="Введите URL вашего GitHub репозитория (например, https://github.com/username/likechat-farcaster.git): "

if "%GITHUB_URL%"=="" (
    echo.
    echo ❌ URL не введен
    echo.
    echo 📝 Создайте репозиторий на GitHub и запустите скрипт снова
    echo.
    pause
    exit /b 1
)

echo.
echo 🔗 Подключаю удаленный репозиторий...

REM Удаляем старый origin если есть
git remote remove origin >nul 2>nul

REM Добавляем новый origin
git remote add origin %GITHUB_URL%
if %ERRORLEVEL% NEQ 0 goto :error

echo ✅ Репозиторий подключен
echo.

echo 📤 Переименовываю ветку в main...
git branch -M main
if %ERRORLEVEL% NEQ 0 goto :error

echo ✅ Ветка переименована
echo.

echo 🚀 Загружаю код на GitHub...
git push -u origin main

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ⚠️  Возможные проблемы:
    echo    - Проверьте правильность URL
    echo    - Убедитесь, что вы вошли в GitHub
    echo    - Возможно нужен Personal Access Token вместо пароля
    echo.
    echo 💡 Создайте токен: https://github.com/settings/tokens
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo 🎉 УСПЕШНО ЗАГРУЖЕНО НА GITHUB!
echo ========================================
echo.
echo ✅ Ваш проект на GitHub: %GITHUB_URL%
echo.
echo 🚀 Следующие шаги:
echo.
echo 1. Настройте Upstash Redis:
echo    https://console.upstash.com/
echo.
echo 2. Деплой в Vercel:
echo    https://vercel.com/new
echo.
echo 3. Добавьте переменные окружения в Vercel:
echo    - UPSTASH_REDIS_REST_URL
echo    - UPSTASH_REDIS_REST_TOKEN
echo    - TOKEN_CONTRACT_ADDRESS
echo.
echo 📖 Подробные инструкции в VERCEL_DEPLOY.md
echo.
pause
exit /b 0

:error
echo.
echo ❌ Произошла ошибка!
echo.
pause
exit /b 1
