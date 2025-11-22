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
git add pages/buyToken.tsx pages/submit.tsx pages/api/submit-link.ts
if errorlevel 1 (
    echo ОШИБКА при добавлении файлов!
    pause
    exit /b 1
)

echo [2/3] Создание коммита...
git commit -m "FIX: Allow link publishing after token purchase without requiring all tasks completion"
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

