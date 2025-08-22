# PowerShell build script for TextViewer - Windows and Android
param(
    [switch]$SkipAndroid = $false
)

Write-Host "Starting PowerShell build script..." -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "    Building TextViewer for Windows and Android" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
Write-Host "Build started at: $(Get-Date)" -ForegroundColor Blue
Write-Host ""

# Function to check command existence
function Test-Command {
    param($Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

# Check for npm
Write-Host "[1/8] Checking npm..." -ForegroundColor Yellow
if (-not (Test-Command "npm")) {
    Write-Host "Error: npm is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
$npmVersion = npm --version
Write-Host "npm found: version $npmVersion" -ForegroundColor Green

# Check for npx
Write-Host "[2/8] Checking npx..." -ForegroundColor Yellow
if (-not (Test-Command "npx")) {
    Write-Host "Error: npx is not available" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
$npxVersion = npx --version
Write-Host "npx found: version $npxVersion" -ForegroundColor Green

# Install dependencies if needed
Write-Host "[3/8] Checking dependencies..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Failed to install dependencies" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
} else {
    Write-Host "Dependencies already installed" -ForegroundColor Green
}

# Clean previous builds
Write-Host "[4/8] Cleaning previous builds..." -ForegroundColor Yellow
if (Test-Path "dist-electron") {
    Remove-Item "dist-electron" -Recurse -Force
}
if (Test-Path "android\app\build\outputs\apk") {
    Remove-Item "android\app\build\outputs\apk" -Recurse -Force
}
Write-Host "Previous builds cleaned" -ForegroundColor Green

# Build CSS
Write-Host "[5/8] Building Tailwind CSS..." -ForegroundColor Yellow
if (-not (Test-Path "src\dist")) {
    New-Item -ItemType Directory -Path "src\dist" -Force | Out-Null
}
npx tailwindcss -i src/styles.css -o src/dist/styles.css --minify
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: CSS build failed" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "CSS build completed" -ForegroundColor Green

# Build Windows EXE
Write-Host "[6/8] Building Windows EXE..." -ForegroundColor Yellow
npm run build-windows
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Windows build failed" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "Windows EXE build completed" -ForegroundColor Green

# Android build (optional)
if (-not $SkipAndroid) {
    # Sync files to Android
    Write-Host "[7/8] Syncing files to Android platform..." -ForegroundColor Yellow
    npx cap sync android
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Android sync failed - skipping Android build" -ForegroundColor Yellow
        $SkipAndroid = $true
    } else {
        Write-Host "Android sync completed" -ForegroundColor Green
    }

    if (-not $SkipAndroid) {
        # Build Android APK
        Write-Host "[8/8] Building Android APK..." -ForegroundColor Yellow
        Set-Location "android"
        .\gradlew.bat assembleDebug --no-daemon
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error: Android build failed" -ForegroundColor Red
            Set-Location ".."
        } else {
            Set-Location ".."
            Write-Host "Android APK build completed" -ForegroundColor Green
        }
    }
} else {
    Write-Host "[7/8] Skipping Android build (use -SkipAndroid flag to skip)" -ForegroundColor Yellow
}

# Build summary
Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host "           Build Completed Successfully!" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Build Summary:" -ForegroundColor Blue
Write-Host "  Build Time: $timestamp" -ForegroundColor White
Write-Host "  Platform: Windows$(if (-not $SkipAndroid) { ' + Android' })" -ForegroundColor White
Write-Host ""

Write-Host "Output Files:" -ForegroundColor Blue
if (Test-Path "dist-electron\win-unpacked\TextViewer.exe") {
    Write-Host "  ✓ Windows EXE: dist-electron\win-unpacked\TextViewer.exe" -ForegroundColor Green
} else {
    Write-Host "  ✗ Windows EXE: Build failed" -ForegroundColor Red
}

if (Test-Path "android\app\build\outputs\apk\debug\app-debug.apk") {
    Write-Host "  ✓ Android APK: android\app\build\outputs\apk\debug\app-debug.apk" -ForegroundColor Green
} else {
    Write-Host "  ✗ Android APK: Build failed or skipped" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Installation Instructions:" -ForegroundColor Blue
Write-Host "  Windows: Run TextViewer.exe directly" -ForegroundColor White
Write-Host "  Android: Enable 'Unknown sources' and install app-debug.apk" -ForegroundColor White
Write-Host "  Web: npm run start (for development)" -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   BUILD COMPLETED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Usage examples
Write-Host "Usage examples:" -ForegroundColor Cyan
Write-Host "  .\build-all.ps1                    # Build both Windows and Android" -ForegroundColor White
Write-Host "  .\build-all.ps1 -SkipAndroid      # Build Windows only" -ForegroundColor White
Write-Host ""

Read-Host "Press Enter to exit"