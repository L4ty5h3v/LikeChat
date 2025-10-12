@echo off
echo ========================================
echo    ЗАПУСК LIKE CHAT
echo ========================================
echo.
echo Переход в папку проекта...
cd /d "C:\Users\Савиных\likechat-farcaster"
echo.
echo Папка: %CD%
echo.
echo Запуск сайта...
echo.
echo После запуска откройте браузер и перейдите на:
echo http://localhost:3000
echo.
echo Нажмите любую клавишу для запуска...
pause
echo.
npm run dev


