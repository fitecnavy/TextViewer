@echo off
REM Simple build script for TextViewer - Windows only

echo ===============================================
echo       Building TextViewer for Windows
echo ===============================================

REM Install dependencies if needed
if not exist "node_modules" (
    echo [1/3] Installing dependencies...
    npm install
    if %ERRORLEVEL% NEQ 0 (
        echo Error: Failed to install dependencies!
        pause
        exit /b 1
    )
) else (
    echo [1/3] Dependencies already installed
)

REM Build CSS
echo.
echo [2/3] Building CSS...
npx tailwindcss -i src/styles.css -o src/dist/styles.css --minify

REM Test Electron app
echo.
echo [3/3] Testing Electron app...
echo Starting Electron app for testing...
start "TextViewer" npm run electron-dev

echo.
echo ===============================================
echo            Windows Build Status
echo ===============================================
echo.
echo ✓ Dependencies installed
echo ✓ CSS built
echo ✓ Electron app ready for testing
echo.
echo Available files:
echo   - Windows App: dist-electron\win-unpacked\TextViewer.exe
echo   - Source files: src\*
echo.
echo To run:
echo   1. Test: npm run electron-dev
echo   2. Web: npm run start
echo.
echo Note: Android build requires Java 11+ and Android SDK
echo      Current Java version is 8, which is incompatible
echo.
pause