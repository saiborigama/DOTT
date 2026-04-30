@echo off
setlocal

set "ROOT=%~dp0"
set "PYTHON=%ROOT%\.venv\Scripts\python.exe"
set "UVICORN=%ROOT%\.venv\Scripts\uvicorn.exe"

if not exist "%PYTHON%" (
  echo Backend virtual environment not found.
  echo Run install_backend.bat first.
  exit /b 1
)

cd /d "%ROOT%"
set "PYTHONIOENCODING=utf-8"
"%UVICORN%" main:app --host 0.0.0.0 --port 8080
