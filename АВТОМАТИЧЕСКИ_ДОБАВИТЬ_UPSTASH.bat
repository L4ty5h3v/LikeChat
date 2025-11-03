@echo off
chcp 65001 >nul
echo.
echo ========================================
echo  🚀 Автоматическое добавление Upstash
echo ========================================
echo.
echo Этот скрипт автоматически добавит переменные Upstash в Vercel
echo после того, как вы создадите базу данных.
echo.
echo ⚠️  СНАЧАЛА создайте базу данных:
echo.
echo    1. Откройте: https://console.upstash.com/
echo    2. Войдите (можно через GitHub)
echo    3. Нажмите "Create Database"
echo    4. Name: likechat-redis
echo    5. Region: выберите ближайший
echo    6. Нажмите "Create"
echo    7. Скопируйте REST URL и REST Token
echo.
echo ========================================
echo.
set /p UPSTASH_URL="Введите UPSTASH_REDIS_REST_URL: "
set /p UPSTASH_TOKEN="Введите UPSTASH_REDIS_REST_TOKEN: "
echo.
echo Добавляю переменные в Vercel...
echo.

echo %UPSTASH_URL% | "C:\Program Files\Git\bin\git.exe" -c "alias.vercel=!vercel" env add UPSTASH_REDIS_REST_URL production
echo %UPSTASH_TOKEN% | vercel env add UPSTASH_REDIS_REST_TOKEN production

echo %UPSTASH_URL% | vercel env add UPSTASH_REDIS_REST_URL preview
echo %UPSTASH_TOKEN% | vercel env add UPSTASH_REDIS_REST_TOKEN preview

echo %UPSTASH_URL% | vercel env add UPSTASH_REDIS_REST_URL development
echo %UPSTASH_TOKEN% | vercel env add UPSTASH_REDIS_REST_TOKEN development

echo.
echo ✅ Переменные добавлены!
echo 🚀 Запускаю новый деплой...
echo.
vercel --prod

echo.
echo ✅ Готово! Upstash подключен!
echo.
pause



