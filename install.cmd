@echo off
echo.
echo   ╔═══════════════════════════════════════╗
echo   ║       NexAnime Installer              ║
echo   ╚═══════════════════════════════════════╝
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

:: Add project directory to user PATH permanently
set "NEXANIME_DIR=%~dp0"
set "NEXANIME_DIR=%NEXANIME_DIR:~0,-1%"

:: Check if already in PATH
echo %PATH% | findstr /i /c:"%NEXANIME_DIR%" >nul 2>&1
if %errorlevel% equ 0 (
    echo   NexAnime is already in your PATH.
) else (
    :: Get current user PATH
    for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USER_PATH=%%b"

    :: Append NexAnime dir
    if defined USER_PATH (
        set "NEW_PATH=%USER_PATH%;%NEXANIME_DIR%"
    ) else (
        set "NEW_PATH=%NEXANIME_DIR%"
    )

    :: Save to registry
    reg add "HKCU\Environment" /v Path /t REG_EXPAND_SZ /d "%NEW_PATH%" /f >nul 2>&1

    :: Also update current session
    setx Path "%NEW_PATH%" >nul 2>&1

    echo   NexAnime added to PATH.
)

echo.
echo   ╔═══════════════════════════════════════╗
echo   ║   Installation Complete!              ║
echo   ║                                       ║
echo   ║   Close this window and open a NEW    ║
echo   ║   terminal, then type:                ║
echo   ║                                       ║
echo   ║       nexanime                        ║
echo   ║                                       ║
echo   ║   to start NexAnime.                  ║
echo   ╚═══════════════════════════════════════╝
echo.
pause
