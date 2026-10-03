@echo off
rem Double-click to start Tweensy on Windows.
title Tweensy
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 app.py
  goto done
)
python -c "import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)" >nul 2>nul
if %errorlevel%==0 (
  python app.py
  goto done
)
echo.
echo   Tweensy needs Python 3.9 or newer.
echo   Install it from the page that just opened, and tick "Add python.exe to PATH".
echo   Or in PowerShell:  winget install Python.Python.3.12
echo   Then double-click this file again.
echo.
start "" "https://www.python.org/downloads/"
:done
pause
