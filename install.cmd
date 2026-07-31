@echo off
echo.
echo   ================= NexAnime Installer =================
echo.

cd /d "%~dp0"

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo   [ERROR] Node.js is not installed.
    echo   Download it from https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Check npm
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo   [ERROR] npm is not installed.
    echo.
    pause
    exit /b 1
)

echo   [1/4] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo   [ERROR] npm install failed.
    pause
    exit /b 1
)

echo.
echo   [2/4] Building NexAnime (this may take a minute)...
call npm run build
if %errorlevel% neq 0 (
    echo   [ERROR] Build failed.
    pause
    exit /b 1
)

echo.
echo   [3/4] Creating nexanime command...

:: Create nexanime.cmd in project root
(
    echo @echo off
    echo cd /d "%~dp0"
    echo node "%~dp0bin\nexanime.js" %%*
) > "%~dp0nexanime.cmd"

echo.
echo   [4/4] Adding NexAnime to your PATH...

:: Use PowerShell to safely update user PATH (avoids registry parsing issues)
set "NEXANIME_DIR=%~dp0"
set "NEXANIME_DIR=%NEXANIME_DIR:~0,-1%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$currentPath = [Environment]::GetEnvironmentVariable('Path', 'User'); ^
   if ($currentPath -like '*%NEXANIME_DIR%*') { ^
     Write-Host '   NexAnime is already in your PATH.' ^
   } else { ^
     $newPath = if ($currentPath) { $currentPath + ';%NEXANIME_DIR%' } else { '%NEXANIME_DIR%' }; ^
     [Environment]::SetEnvironmentVariable('Path', $newPath, 'User'); ^
     Write-Host '   NexAnime added to PATH.' ^
   }"

echo.
echo   ================= Installation Complete =================
echo.
echo   Close this window and open a NEW terminal, then type:
echo.
echo       nexanime
echo
echo   to start NexAnime.
echo.
pause
