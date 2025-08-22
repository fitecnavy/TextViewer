@echo off
REM Release build script for TextViewer - Creates production-ready EXE and APK

echo ===============================================
echo       Building TextViewer RELEASE Version
echo ===============================================

REM Check if version should be updated
set /p updateVersion="Update version before build? (y/N): "
if /i "%updateVersion%"=="y" (
    echo Current version:
    npm version --json | findstr "text-viewer"
    set /p newVersion="Enter new version (e.g., 1.0.1): "
    npm version %newVersion% --no-git-tag-version
)

REM Install dependencies
echo.
echo [1/7] Installing/updating dependencies...
npm install

REM Build CSS for production
echo.
echo [2/7] Building production CSS...
npx tailwindcss -i src/styles.css -o src/dist/styles.css --minify

REM Create production assets
if not exist "assets" (
    echo [3/7] Creating assets directory...
    mkdir assets
    echo Warning: Please add proper icon files for production builds
) else (
    echo [3/7] Assets directory exists
)

REM Build Windows EXE for release
echo.
echo [4/7] Building Windows EXE (Release)...
npm run build-windows

if %ERRORLEVEL% NEQ 0 (
    echo Error: Windows release build failed!
    pause
    exit /b 1
)

REM Prepare Capacitor
echo.
echo [5/7] Preparing Capacitor for Android...
if not exist "capacitor.config.ts" (
    npx cap init
)

if not exist "android" (
    npx cap add android
)

npx cap sync android

REM Build Android APK for release
echo.
echo [6/7] Building Android APK (Release)...
cd android

REM Build release APK (unsigned)
call gradlew assembleRelease

if %ERRORLEVEL% NEQ 0 (
    echo Error: Android release build failed!
    cd ..
    pause
    exit /b 1
)

cd ..

REM Copy files to release directory
echo.
echo [7/7] Organizing release files...
if not exist "release" mkdir release

REM Copy Windows builds
if exist "dist-electron" (
    xcopy "dist-electron\*.exe" "release\" /Y
    echo Windows EXE files copied to release directory
)

REM Copy Android APK
if exist "android\app\build\outputs\apk\release\app-release-unsigned.apk" (
    copy "android\app\build\outputs\apk\release\app-release-unsigned.apk" "release\TextViewer-release.apk"
    echo Android APK copied to release directory
)

if exist "android\app\build\outputs\apk\debug\app-debug.apk" (
    copy "android\app\build\outputs\apk\debug\app-debug.apk" "release\TextViewer-debug.apk"
    echo Android Debug APK copied to release directory
)

echo.
echo ===============================================
echo          RELEASE BUILD COMPLETED!
echo ===============================================
echo.
echo Release files are in the 'release' directory:
dir release /b
echo.
echo Next steps:
echo   1. Test the EXE file on Windows
echo   2. Test the APK file on Android device
echo   3. For signed APK, configure signing in Android Studio
echo.
pause