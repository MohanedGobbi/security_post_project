@echo off
rem Opens the landing page for a presentation, offline. Builds it the first time.
cd /d "%~dp0"
if not exist node_modules call npm install
if not exist dist\index.html call npm run site
node serve.mjs
