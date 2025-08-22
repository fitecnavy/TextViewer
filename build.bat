@echo off
REM Build script for TextViewer - Creates both EXE and APK files

echo ===============================================
echo    Building TextViewer for Windows and Android
echo ===============================================

REM Install dependencies if needed
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
)

REM Build CSS
echo.
echo [1/6] Building Tailwind CSS...
npx tailwindcss -i src/styles.css -o src/dist/styles.css --minify

REM Create assets directory if needed
if not exist "assets" (
    echo [2/6] Creating assets directory...
    mkdir assets
    echo Warning: Please add icon files to assets directory for proper builds
)

REM Build Windows EXE
echo.
echo [3/6] Building Windows EXE...
echo Building Electron app for Windows...
npm run build-windows

if %ERRORLEVEL% NEQ 0 (
    echo Error: Windows build failed!
    pause
    exit /b 1
)

REM Initialize Capacitor if needed
if not exist "capacitor.config.ts" (
    echo [4/6] Initializing Capacitor...
    npx cap init
)

REM Add Android platform if needed
if not exist "android" (
    echo [5/6] Adding Android platform...
    npx cap add android
)

REM Sync files and build Android APK
echo.
echo [6/6] Building Android APK...
npx cap sync android

REM Build APK using Gradle
echo Building APK with Gradle...
cd android
call gradlew assembleDebug

if %ERRORLEVEL% NEQ 0 (
    echo Error: Android build failed!
    cd ..
    pause
    exit /b 1
)

cd ..

echo.
echo ===============================================
echo            Build Completed Successfully!
echo ===============================================
echo.
echo Output files:
echo   Windows EXE: dist-electron\TextViewer Setup *.exe
echo   Portable EXE: dist-electron\TextViewer-*-portable.exe
echo   Android APK: android\app\build\outputs\apk\debug\app-debug.apk
echo.
echo To test:
echo   Windows: Run the generated EXE file
echo   Android: Install the APK file on your device
echo   Browser: npm run start
echo.
pause