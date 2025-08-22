@echo off
REM Start development server for TextViewer

echo Starting TextViewer development server...

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
)

REM Build CSS
echo Building Tailwind CSS...
npx tailwindcss -i src/styles.css -o src/dist/styles.css

REM Start live server
echo Starting live server on http://localhost:3000...
npx live-server src --port=3000 --open