@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
cd /d "%ROOT%"

set "VENV_PY=%ROOT%\.venv\Scripts\python.exe"
set "VENV_UVICORN=%ROOT%\.venv\Scripts\uvicorn.exe"
set "MYSQL_PY=C:\Program Files\MySQL\MySQL Shell 8.0\lib\Python3.12\Lib\venv\scripts\nt\python.exe"
set "MYSQL_BASE=C:\Program Files\MySQL\MySQL Shell 8.0\lib\Python3.12"

set "BASE_PY="
if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" set "BASE_PY=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
if not defined BASE_PY if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set "BASE_PY=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
if not defined BASE_PY if exist "C:\Program Files\Python311\python.exe" set "BASE_PY=C:\Program Files\Python311\python.exe"
if not defined BASE_PY if exist "C:\Program Files\Python312\python.exe" set "BASE_PY=C:\Program Files\Python312\python.exe"
if not defined BASE_PY if exist "%MYSQL_PY%" set "BASE_PY=%MYSQL_PY%"

if not exist "%VENV_PY%" (
  if not defined BASE_PY (
    echo No usable Python installation was found.
    echo Install Python 3.11 or 3.12 and run this file again.
    exit /b 1
  )

  echo Creating backend virtual environment...
  "%BASE_PY%" -m venv "%ROOT%\.venv"
  if errorlevel 1 (
    echo Failed to create backend virtual environment.
    exit /b 1
  )

  if /i "%BASE_PY%"=="%MYSQL_PY%" (
    if not exist "%ROOT%\.venv\DLLs" mkdir "%ROOT%\.venv\DLLs" >nul 2>nul
    copy /Y "%MYSQL_BASE%\Lib\venv\scripts\nt\libssl-3-x64.dll" "%ROOT%\.venv\Scripts\" >nul
    copy /Y "%MYSQL_BASE%\Lib\venv\scripts\nt\libcrypto-3-x64.dll" "%ROOT%\.venv\Scripts\" >nul
    copy /Y "%MYSQL_BASE%\Lib\venv\scripts\nt\python312.dll" "%ROOT%\.venv\Scripts\" >nul
    copy /Y "%MYSQL_BASE%\Lib\venv\scripts\nt\vcruntime140.dll" "%ROOT%\.venv\Scripts\" >nul
    copy /Y "%MYSQL_BASE%\Lib\venv\scripts\nt\vcruntime140_1.dll" "%ROOT%\.venv\Scripts\" >nul
    copy /Y "%MYSQL_BASE%\DLLs\_ssl.pyd" "%ROOT%\.venv\DLLs\" >nul
  )
)

if not exist "%VENV_PY%" (
  echo Backend virtual environment is missing after setup.
  exit /b 1
)

echo Installing backend core dependencies...
"%VENV_PY%" -m pip install --no-cache-dir -r "%ROOT%requirements-core.txt"
if errorlevel 1 (
  echo Core dependency installation failed.
  exit /b 1
)

echo PostgreSQL driver is included in backend core dependencies.

if /i "%1"=="--core-only" (
  echo Core backend setup finished.
  echo Run start_backend.bat to launch the API.
  exit /b 0
)

echo Installing backend AI dependencies...
"%VENV_PY%" -m pip install --no-cache-dir -r "%ROOT%requirements-ai.txt"
if errorlevel 1 (
  echo.
  echo AI dependency installation did not finish.
  echo Core API is ready, but AI image-processing features are still pending.
  echo You can rerun this file later, or use:
  echo   install_backend.bat --core-only
  exit /b 1
)

if not exist "%VENV_UVICORN%" (
  echo Uvicorn executable was not installed correctly.
  exit /b 1
)

echo.
echo Backend setup finished successfully.
echo Start the API with:
echo   start_backend.bat
exit /b 0
