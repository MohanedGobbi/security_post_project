@echo off
rem Starts the faculty security program: rebuilds it (a second or two, so it always runs the latest code), then opens it.
rem The desktop shortcut runs this file minimized. Data stays in %APPDATA%\FacultySecurity.
cd /d "%~dp0.."
call npm run build >nul 2>&1
if errorlevel 1 (
  echo The build failed. Run "npm run build" in this folder to see why.
  pause
  exit /b 1
)
start "" "node_modules\electron\dist\electron.exe" .
