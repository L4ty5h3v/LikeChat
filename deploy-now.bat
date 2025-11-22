@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo ========================================
echo   Отправка изменений в Vercel
echo ========================================
echo.

echo [1/3] Добавление файлов...
git add -A
git add lib/upstash-db.ts pages/api/submit-link.ts pages/submit.tsx pages/tasks.tsx tailwind.config.js APP_LOGIC.md FULL_SEQUENCE.md
if errorlevel 1 (
    echo ОШИБКА при добавлении файлов!
    pause
    exit /b 1
)

echo [2/3] Создание коммита...
git commit -m "FIX: Full-screen congratulations page, fix routing conflicts (remove app folder), improve task sorting"
if errorlevel 1 (
    echo ОШИБКА при создании коммита! Возможно, нет изменений для коммита.
    pause
    exit /b 1
)

echo [3/3] Отправка на GitHub...
git push origin main
if errorlevel 1 (
    echo ОШИБКА при отправке на GitHub!
    pause
    exit /b 1
)

echo.
echo ========================================
echo   УСПЕШНО! Изменения отправлены!
echo ========================================
echo.
echo Vercel автоматически задеплоит изменения
echo в течение 2-3 минут.
echo.
pause

