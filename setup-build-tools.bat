@echo off
REM Setup build tools for TextViewer development

echo ===============================================
echo    Setting up TextViewer Build Environment
echo ===============================================

echo.
echo [1/4] Checking Node.js installation...
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Error: Node.js is not installed!
    echo Please install Node.js from: https://nodejs.org/
    pause
    exit /b 1
) else (
    echo Node.js is installed: 
    node --version
)

echo.
echo [2/4] Checking Java installation for Android builds...
java -version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Warning: Java is not installed!
    echo For Android builds, please install Java JDK 8 or higher
    echo Download from: https://www.oracle.com/java/technologies/downloads/
) else (
    echo Java is installed:
    java -version
)

echo.
echo [3/4] Checking Android SDK...
if not defined ANDROID_HOME (
    echo Warning: ANDROID_HOME environment variable is not set!
    echo For Android builds, please:
    echo   1. Install Android Studio
    echo   2. Set ANDROID_HOME environment variable
    echo   3. Add Android SDK tools to PATH
) else (
    echo Android SDK found at: %ANDROID_HOME%
)

echo.
echo [4/4] Installing project dependencies...
if not exist "node_modules" (
    npm install
    if %ERRORLEVEL% NEQ 0 (
        echo Error: Failed to install dependencies!
        pause
        exit /b 1
    )
) else (
    echo Dependencies already installed, updating...
    npm update
)

echo.
echo ===============================================
echo          Build Environment Setup Complete
echo ===============================================
echo.
echo Available commands:
echo   start.bat          - Start development server
echo   build.bat          - Build EXE and APK files
echo   npm run electron-dev - Run Electron app in development
echo.
echo Requirements for full builds:
echo   ✓ Node.js (installed)
if defined JAVA_HOME (
    echo   ✓ Java JDK (installed^)
) else (
    echo   ⚠ Java JDK (recommended for Android builds^)
)
if defined ANDROID_HOME (
    echo   ✓ Android SDK (installed^)
) else (
    echo   ⚠ Android SDK (required for APK builds^)
)
echo.
pause