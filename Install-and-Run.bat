@echo off
title Setting up CharChat...
echo ===================================================
echo Welcome to CharChat! Setting up for first-time use...
echo ===================================================
echo [1/2] Installing Backend Dependencies...
cd /d "%~dp0backend"
call npm install
call npm run build

echo [2/2] Installing Frontend Dependencies...
cd /d "%~dp0frontend"
call npm install
call npm run build

cd /d "%~dp0"
echo ===================================================
echo Setup complete! Launching CharChat now...
echo ===================================================
wscript "Launch CharChat.vbs"
