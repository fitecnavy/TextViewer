@echo off
REM Enhanced build script for TextViewer - Creates both EXE and APK files
setlocal enabledelayedexpansion

echo Starting build script...

echo ===============================================
echo    Building TextViewer for Windows and Android
echo ===============================================

REM Set build timestamp
set TIMESTAMP=%date:~10,4%-%date:~4,2%-%date:~7,2%_%time:~0,2%-%time:~3,2%-%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%

echo Build started at: %date% %time%
echo.

REM Check for required tools
echo [1/8] Checking build environment...

REM Try to find npm in common locations
set "NPM_PATH="
for %%i in (npm.cmd) do set "NPM_PATH=%%~$PATH:i"
if not defined NPM_PATH (
    REM Try common Node.js installation paths
    if exist "%ProgramFiles%\nodejs\npm.cmd" set "NPM_PATH=%ProgramFiles%\nodejs\npm.cmd"
    if exist "%ProgramFiles(x86)%\nodejs\npm.cmd" set "NPM_PATH=%ProgramFiles(x86)%\nodejs\npm.cmd"
    if exist "%APPDATA%\npm\npm.cmd" set "NPM_PATH=%APPDATA%\npm\npm.cmd"
    if exist "%USERPROFILE%\AppData\Roaming\npm\npm.cmd" set "NPM_PATH=%USERPROFILE%\AppData\Roaming\npm\npm.cmd"
)

if not defined NPM_PATH (
    echo %RED%Error: npm is not installed or not in PATH%RESET%
    echo Please install Node.js from https://nodejs.org/
    echo.
    echo Press any key to close this window...
    pause >nul
    exit /b 1
)

echo Found npm at: %NPM_PATH%

REM Check for npx (usually comes with npm)
set "NPX_PATH="
for %%i in (npx.cmd) do set "NPX_PATH=%%~$PATH:i"
if not defined NPX_PATH (
    REM Try to find npx with npm
    for %%f in ("%NPM_PATH%") do set "NPX_PATH=%%~dpfnpx.cmd"
)

if not exist "%NPX_PATH%" (
    echo %RED%Error: npx is not available%RESET%
    echo.
    echo Press any key to close this window...
    pause >nul
    exit /b 1
)

echo Found npx at: %NPX_PATH%

echo %GREEN%Build environment OK%RESET%

REM Install dependencies if needed
echo.
echo %BLUE%[2/8] Checking dependencies...%RESET%
if not exist "node_modules" (
    echo %YELLOW%Installing dependencies...%RESET%
    "%NPM_PATH%" install
    if !ERRORLEVEL! NEQ 0 (
        echo %RED%Error: Failed to install dependencies%RESET%
        echo.
        echo Press any key to close this window...
        pause >nul
        exit /b 1
    )
) else (
    echo %GREEN%Dependencies already installed%RESET%
)

REM Clean previous builds
echo.
echo %BLUE%[3/8] Cleaning previous builds...%RESET%
if exist "dist-electron" (
    rmdir /s /q "dist-electron" 2>nul
)
if exist "android\app\build\outputs\apk" (
    rmdir /s /q "android\app\build\outputs\apk" 2>nul
)
echo %GREEN%Previous builds cleaned%RESET%

REM Build CSS
echo.
echo %BLUE%[4/8] Building Tailwind CSS...%RESET%
if not exist "src\dist" mkdir "src\dist"
"%NPX_PATH%" tailwindcss -i src/styles.css -o src/dist/styles.css --minify
if %ERRORLEVEL% NEQ 0 (
    echo %RED%Error: CSS build failed%RESET%
    echo.
    echo Press any key to close this window...
    pause >nul
    exit /b 1
)
echo %GREEN%CSS build completed%RESET%

REM Create assets directory if needed
if not exist "assets" (
    echo %YELLOW%Creating assets directory...%RESET%
    mkdir assets
    echo Warning: Please add icon files to assets directory for proper builds
)

REM Build Windows EXE
echo.
echo %BLUE%[5/8] Building Windows EXE...%RESET%
echo Building Electron app for Windows...
"%NPM_PATH%" run build-windows
if %ERRORLEVEL% NEQ 0 (
    echo %RED%Error: Windows build failed!%RESET%
    echo.
    echo Press any key to close this window...
    pause >nul
    exit /b 1
)
echo %GREEN%Windows EXE build completed%RESET%

REM Initialize Capacitor if needed
echo.
echo %BLUE%[6/8] Checking Capacitor configuration...%RESET%
if not exist "capacitor.config.ts" (
    echo %YELLOW%Initializing Capacitor...%RESET%
    "%NPX_PATH%" cap init TextViewer com.textviewer.app
    if !ERRORLEVEL! NEQ 0 (
        echo %RED%Error: Capacitor initialization failed%RESET%
        echo.
        echo Press any key to close this window...
        pause >nul
        exit /b 1
    )
) else (
    echo %GREEN%Capacitor already configured%RESET%
)

REM Add Android platform if needed
if not exist "android" (
    echo %YELLOW%Adding Android platform...%RESET%
    "%NPX_PATH%" cap add android
    if !ERRORLEVEL! NEQ 0 (
        echo %RED%Error: Failed to add Android platform%RESET%
        echo.
        echo Press any key to close this window...
        pause >nul
        exit /b 1
    )
) else (
    echo %GREEN%Android platform already added%RESET%
)

REM Sync files and build Android APK
echo.
echo %BLUE%[7/8] Syncing files to Android platform...%RESET%
"%NPX_PATH%" cap sync android
if %ERRORLEVEL% NEQ 0 (
    echo %RED%Error: Android sync failed%RESET%
    echo.
    echo Press any key to close this window...
    pause >nul
    exit /b 1
)
echo %GREEN%Android sync completed%RESET%

REM Build APK using Gradle
echo.
echo %BLUE%[8/8] Building Android APK...%RESET%
echo Building APK with Gradle...
cd android
call gradlew assembleDebug --no-daemon --info

if %ERRORLEVEL% NEQ 0 (
    echo %RED%Error: Android build failed!%RESET%
    cd ..
    echo.
    echo Press any key to close this window...
    pause >nul
    exit /b 1
)

cd ..
echo %GREEN%Android APK build completed%RESET%

REM Create build summary
echo.
echo %GREEN%===============================================%RESET%
echo %GREEN%           Build Completed Successfully!%RESET%
echo %GREEN%===============================================%RESET%
echo.
echo %BLUE%Build Summary:%RESET%
echo   Build Time: %TIMESTAMP%
echo   Platform: Windows + Android
echo.
echo %BLUE%Output Files:%RESET%
for %%f in ("dist-electron\*.exe") do (
    echo   Windows EXE: %%f (~%%~zf bytes)
)
for %%f in ("android\app\build\outputs\apk\debug\*.apk") do (
    echo   Android APK: %%f (~%%~zf bytes)
)
echo.
echo %BLUE%File Locations:%RESET%
echo   Windows: dist-electron\win-unpacked\TextViewer.exe
echo   Android: android\app\build\outputs\apk\debug\app-debug.apk
echo.
echo %BLUE%Installation Instructions:%RESET%
echo   Windows: Run TextViewer.exe directly or use installer
echo   Android: Enable "Unknown sources" and install app-debug.apk
echo   Web: npm run start ^(for development^)
echo.
echo %YELLOW%Tip: Use 'build-release.bat' for production builds%RESET%
echo.
echo %GREEN%========================================%RESET%
echo %GREEN%  BUILD COMPLETED SUCCESSFULLY! ✓  %RESET%
echo %GREEN%========================================%RESET%
echo.
echo Press any key to close this window...
pause >nul