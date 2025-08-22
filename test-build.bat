@echo off
echo Starting test build script...
echo Current directory: %CD%
echo.

REM Check npm
echo Checking npm...
where npm
npm --version
echo.

REM Build CSS
echo Building CSS...
npm run build-css-prod
echo CSS build completed.
echo.

REM Build Windows
echo Building Windows EXE...
npm run build-windows
echo Windows build completed.
echo.

REM Check Capacitor
echo Checking Capacitor...
npx cap sync android
echo Capacitor sync completed.
echo.

REM Build Android
echo Building Android APK...
cd android
echo Current directory: %CD%
call gradlew.bat assembleDebug --no-daemon
cd ..
echo Android build completed.
echo.

echo Build script finished!
pause