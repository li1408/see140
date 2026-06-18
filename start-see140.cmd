@echo off
setlocal

cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-see140.ps1"

echo.
echo This launcher window can be closed. Keep the server window open while using see140.
pause
