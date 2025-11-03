@echo off
chcp 65001 >nul
echo ========================================
echo 🚀 LikeChat - Загрузка на GitHub
echo ========================================
echo.

REM Проверка наличия Git
where git >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Git не установлен!
    echo 📥 Скачайте Git с https://git-scm.com/download/win
    echo.
    pause
    exit /b 1
)

echo ✅ Git обнаружен
echo.

REM Проверка, есть ли уже репозиторий
if exist .git (
    echo 📁 Git репозиторий уже существует
    echo.
    choice /C YN /M "Хотите создать новый коммит?"
    if errorlevel 2 goto :end
    goto :commit
)

echo 📝 Инициализация Git репозитория...
git init

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Ошибка инициализации Git
    pause
    exit /b 1
)

echo ✅ Git репозиторий инициализирован
echo.

:commit
echo 📦 Добавление файлов...
git add .

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Ошибка добавления файлов
    pause
    exit /b 1
)

echo ✅ Файлы добавлены
echo.

echo 💾 Создание коммита...
git commit -m "Initial commit: LikeChat project with Upstash Redis integration"

if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  Возможно, нет изменений для коммита
)

echo.
echo ========================================
echo 🎯 Следующие шаги:
echo ========================================
echo.
echo 1. Создайте репозиторий на GitHub:
echo    https://github.com/new
echo.
echo 2. Назовите его: likechat-farcaster
echo.
echo 3. НЕ создавайте README, .gitignore, license
echo.
echo 4. После создания выполните команды:
echo.
echo    git remote add origin https://github.com/ВАШ_ЛОГИН/likechat-farcaster.git
echo    git branch -M main
echo    git push -u origin main
echo.
echo ========================================
echo.

:end
pause





