@echo off
echo Starting build script...
echo ===============================================
echo       Building TextViewer 
echo ===============================================

REM Check npm
echo [1/5] Checking npm...
npm --version
if %ERRORLEVEL% NEQ 0 (
    echo Error: npm not found!
    pause
    exit /b 1
)

REM Install dependencies if needed
if not exist "node_modules" (
    echo [2/5] Installing dependencies...
    npm install
    if %ERRORLEVEL% NEQ 0 (
        echo Error: Failed to install dependencies!
        pause
        exit /b 1
    )
) else (
    echo [2/5] Dependencies already installed
)

REM Build CSS
echo.
echo [3/5] Building CSS...
npx tailwindcss -i src/styles.css -o src/dist/styles.css --minify
if %ERRORLEVEL% NEQ 0 (
    echo Error: CSS build failed!
    pause
    exit /b 1
)

REM Build Windows EXE
echo.
echo [4/5] Building Windows EXE...
npm run build-windows
if %ERRORLEVEL% NEQ 0 (
    echo Error: Windows build failed!
    pause
    exit /b 1
)

REM Build Android APK
echo.
echo [5/5] Building Android APK...
npx cap sync android
if %ERRORLEVEL% NEQ 0 (
    echo Capacitor sync failed - skipping Android build
    goto :summary
)

cd android
gradlew.bat assembleDebug --no-daemon
if %ERRORLEVEL% NEQ 0 (
    echo Android build failed - Windows build still available
)
cd ..

:summary
echo.
echo ===============================================
echo            Build Summary
echo ===============================================
echo.
if exist "dist-electron\win-unpacked\TextViewer.exe" (
    echo ✓ Windows EXE: dist-electron\win-unpacked\TextViewer.exe
) else (
    echo ✗ Windows EXE build failed
)

if exist "android\app\build\outputs\apk\debug\app-debug.apk" (
    echo ✓ Android APK: android\app\build\outputs\apk\debug\app-debug.apk
) else (
    echo ✗ Android APK build failed or skipped
)

echo.
echo Build completed!
pause