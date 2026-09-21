@echo off
setlocal
cd /d "%~dp0\.."

where python >nul 2>&1
if errorlevel 1 (
  echo Python was not found in PATH.
  pause
  exit /b 1
)

python -m pip install -r backend\requirements.txt
if errorlevel 1 (
  echo Failed to install AD User Provisioning Simulator dependencies.
  pause
  exit /b 1
)

echo.
echo Starting AD User Provisioning Simulator...
echo Open http://127.0.0.1:8830
echo.
python backend\directory_api.py
pause
