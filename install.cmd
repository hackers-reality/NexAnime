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

:: Clean stale dev artifacts that corrupt production builds
if exist ".next\dev" (
    echo   Stale dev cache detected — cleaning before build...
    rmdir /s /q ".next" >nul 2>&1
)

call npm run build
if %errorlevel% neq 0 (
    echo   [ERROR] Build failed.
    pause
    exit /b 1
)

:: Verify production build was created
if not exist ".next\BUILD_ID" (
    echo   [ERROR] Build completed but no production build was found.
    echo   Run "npm run build" manually and check for errors.
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

set "NEXANIME_DIR=%~dp0"
set "NEXANIME_DIR=%NEXANIME_DIR:~0,-1%"

:: Write PowerShell script to temp file using individual echo lines (avoids CMD block parsing issues)
set "PS_SCRIPT=%TEMP%\nexanime_path.ps1"

echo param([string]$Dir) > "%PS_SCRIPT%"
echo $currentPath = [Environment]::GetEnvironmentVariable('Path', 'User') >> "%PS_SCRIPT%"
echo if ($currentPath -like "*$Dir*") { >> "%PS_SCRIPT%"
echo     Write-Host '   NexAnime is already in your PATH.' >> "%PS_SCRIPT%"
echo } else { >> "%PS_SCRIPT%"
echo     if ($currentPath) { >> "%PS_SCRIPT%"
echo         $newPath = $currentPath + ';' + $Dir >> "%PS_SCRIPT%"
echo     } else { >> "%PS_SCRIPT%"
echo         $newPath = $Dir >> "%PS_SCRIPT%"
echo     } >> "%PS_SCRIPT%"
echo     try { >> "%PS_SCRIPT%"
echo         [Environment]::SetEnvironmentVariable('Path', $newPath, 'User') >> "%PS_SCRIPT%"
echo         Write-Host '   NexAnime added to PATH.' >> "%PS_SCRIPT%"
echo     } catch { >> "%PS_SCRIPT%"
echo         Write-Host '   [ERROR] Failed to update PATH:' >> "%PS_SCRIPT%"
echo         Write-Host $_.Exception.Message >> "%PS_SCRIPT%"
echo         exit 1 >> "%PS_SCRIPT%"
echo     } >> "%PS_SCRIPT%"
echo } >> "%PS_SCRIPT%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%" -Dir "%NEXANIME_DIR%"
set "PS_EXIT=%errorlevel%"

del "%PS_SCRIPT%" >nul 2>&1

if %PS_EXIT% neq 0 (
    echo.
    echo   [WARNING] PATH setup encountered an issue.
    echo   You can manually add this directory to your PATH:
    echo     %NEXANIME_DIR%
    echo.
    echo   nexanime.cmd was created and works from the project directory.
    echo.
    pause
    exit /b 1
)

echo.
echo   ================= Installation Complete =================
echo.
echo   Close this window and open a NEW terminal, then type:
echo.
echo       nexanime
echo.
echo   to start NexAnime.
echo.
pause
