@echo off
setlocal
cd /d "%~dp0"
title SREDA AI 9.0 [Console]

where py >nul 2>&1
if %errorlevel% equ 0 (
    py run.py
    goto :done
)

where python >nul 2>&1
if %errorlevel% equ 0 (
    python run.py
    goto :done
)

echo.
echo [!] Python not found in PATH. Please install Python 3.10+ and add it to PATH.
pause

:done
endlocal
