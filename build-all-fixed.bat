@echo off
REM Simple build script for TextViewer - Windows and Android
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

REM Check for npm
echo [1/8] Checking npm...
npm --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Error: npm is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)
echo npm found and working

REM Check for npx
echo [2/8] Checking npx...
npx --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Error: npx is not available
    pause
    exit /b 1
)
echo npx found and working

REM Install dependencies if needed
echo [3/8] Checking dependencies...
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    if !ERRORLEVEL! NEQ 0 (
        echo Error: Failed to install dependencies
        pause
        exit /b 1
    )
) else (
    echo Dependencies already installed
)

REM Clean previous builds
echo [4/8] Cleaning previous builds...
if exist "dist-electron" (
    rmdir /s /q "dist-electron" 2>nul
)
if exist "android\app\build\outputs\apk" (
    rmdir /s /q "android\app\build\outputs\apk" 2>nul
)
echo Previous builds cleaned

REM Build CSS
echo [5/8] Building Tailwind CSS...
if not exist "src\dist" mkdir "src\dist"
npx tailwindcss -i src/styles.css -o src/dist/styles.css --minify
if %ERRORLEVEL% NEQ 0 (
    echo Error: CSS build failed
    pause
    exit /b 1
)
echo CSS build completed

REM Build Windows EXE
echo [6/8] Building Windows EXE...
npm run build-windows
if %ERRORLEVEL% NEQ 0 (
    echo Error: Windows build failed
    pause
    exit /b 1
)
echo Windows EXE build completed

REM Sync files to Android
echo [7/8] Syncing files to Android platform...
npx cap sync android
if %ERRORLEVEL% NEQ 0 (
    echo Error: Android sync failed - skipping Android build
    goto :summary
)
echo Android sync completed

REM Build Android APK
echo [8/8] Building Android APK...
cd android
call gradlew assembleDebug --no-daemon
if %ERRORLEVEL% NEQ 0 (
    echo Error: Android build failed
    cd ..
    goto :summary
)
cd ..
echo Android APK build completed

:summary
echo.
echo ===============================================
echo           Build Completed Successfully!
echo ===============================================
echo.
echo Build Summary:
echo   Build Time: %TIMESTAMP%
echo   Platform: Windows + Android
echo.

echo Output Files:
if exist "dist-electron\win-unpacked\TextViewer.exe" (
    echo   ✓ Windows EXE: dist-electron\win-unpacked\TextViewer.exe
) else (
    echo   ✗ Windows EXE: Build failed
)

if exist "android\app\build\outputs\apk\debug\app-debug.apk" (
    echo   ✓ Android APK: android\app\build\outputs\apk\debug\app-debug.apk
) else (
    echo   ✗ Android APK: Build failed or skipped
)

echo.
echo Installation Instructions:
echo   Windows: Run TextViewer.exe directly
echo   Android: Enable "Unknown sources" and install app-debug.apk
echo   Web: npm run start (for development)
echo.
echo ========================================
echo   BUILD COMPLETED SUCCESSFULLY!
echo ========================================
echo.
pause