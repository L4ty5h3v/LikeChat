@echo off
echo Preparing flirt project...
cd ..
if exist flirt rmdir /s /q flirt
xcopy /E /I /Y likechat-farcaster\project1 flirt
echo Done! Project copied to ..\flirt
echo.
echo Next steps:
echo 1. cd ..\flirt
echo 2. git init
echo 3. git add .
echo 4. git commit -m "Initial commit"
echo 5. Create repository on GitHub named "flirt"
echo 6. git remote add origin https://github.com/L4ty5h3v/flirt.git
echo 7. git push -u origin main
pause

















