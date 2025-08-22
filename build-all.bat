@echo off
REM Enhanced build script for TextViewer - Creates both EXE and APK files with improved error handling
setlocal enabledelayedexpansion

REM Test if we can actually see output
echo Starting build script...

echo ===============================================
echo    Building TextViewer for Windows and Android
echo ===============================================

REM Color settings for better visibility
set "GREEN=[92m"
set "RED=[91m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "RESET=[0m"

REM Set build timestamp
set TIMESTAMP=%date:~10,4%-%date:~4,2%-%date:~7,2%_%time:~0,2%-%time:~3,2%-%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%

echo %BLUE%Build started at: %date% %time%%RESET%
echo.

REM Check for required tools
echo %BLUE%[1/8] Checking build environment...%RESET%
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo %RED%Error: npm is not installed or not in PATH%RESET%
    echo.
    echo Press any key to close this window...
    pause >nul
    exit /b 1
)

where npx >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo %RED%Error: npx is not available%RESET%
    echo.
    echo Press any key to close this window...
    pause >nul
    exit /b 1
)

echo %GREEN%Build environment OK%RESET%

REM Install dependencies if needed
echo.
echo %BLUE%[2/8] Checking dependencies...%RESET%
if not exist "node_modules" (
    echo %YELLOW%Installing dependencies...%RESET%
    npm install
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
npx tailwindcss -i src/styles.css -o src/dist/styles.css --minify
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
npm run build-windows
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
    npx cap init TextViewer com.textviewer.app
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
    npx cap add android
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
npx cap sync android
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