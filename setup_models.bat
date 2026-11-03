@echo off
setlocal
cd /d "%~dp0"
title SREDA AI — Model Downloader & Setup

where py >nul 2>&1
if %errorlevel% equ 0 (
    py download_models.py
    goto :done
)

where python >nul 2>&1
if %errorlevel% equ 0 (
    python download_models.py
    goto :done
)

echo.
echo [!] Python 3.10+ not found in PATH.
echo Please install Python from https://www.python.org/
pause

:done
endlocal
