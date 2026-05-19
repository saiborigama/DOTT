@echo off
setlocal

set "ROOT=%~dp0"
set "PYTHON=%ROOT%\.venv\Scripts\python.exe"

if not exist "%PYTHON%" (
  echo Backend virtual environment not found.
  echo Run install_backend.bat first.
  exit /b 1
)

cd /d "%ROOT%"
set "PYTHONIOENCODING=utf-8"
"%PYTHON%" migrate_sqlite_to_postgres.py
