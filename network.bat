@echo off
echo === NexAnime Network Setup ===
echo.
echo This will add 'nexanime.local' to your hosts file pointing to 127.0.0.1
echo and start the dev server on all network interfaces.
echo.
echo NOTE: Run this script AS ADMINISTRATOR for hosts file modification.
echo If not admin, only the dev server will start (access via local IP).
echo.

:: Get local IP for display
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr IPv4 ^| findstr [0-9].\.') do set LOCAL_IP=%%i
set LOCAL_IP=%LOCAL_IP: =%

:: Add to hosts file (if admin)
echo Attempting to add '127.0.0.1 nexanime.local' to hosts file...
findstr /C:"nexanime.local" C:\Windows\System32\drivers\etc\hosts >nul 2>&1
if errorlevel 1 (
    echo 127.0.0.1 nexanime.local >> C:\Windows\System32\drivers\etc\hosts 2>nul
    if errorlevel 1 (
        echo [WARNING] Could not write to hosts file. Run as Administrator.
        echo   Manual: Add "127.0.0.1 nexanime.local" to C:\Windows\System32\drivers\etc\hosts
    ) else (
        echo [OK] Added nexanime.local to hosts file.
    )
) else (
    echo [OK] nexanime.local already in hosts file.
)

echo.
echo === Access URLs ===
echo   Local:    http://nexanime.local:3000
echo   Local:    http://localhost:3000
echo   Network:  http://%LOCAL_IP%:3000
echo.
echo Starting dev server...
echo (Press Ctrl+C to stop)
echo.

npm run dev:host
pause
