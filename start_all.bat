@echo off
title SCYP_X - Financial Event Impact Graph & XAI Launcher
echo ======================================================================
echo    Starting SCYP_X: Backend (FastAPI) + Frontend (Vite React)
echo ======================================================================

echo [1/2] Starting FastAPI Backend on http://localhost:8000 ...
if exist "%~dp0.venv\Scripts\python.exe" (
    start "SCYP_X Backend" cmd /k "cd /d %~dp0 && .venv\Scripts\python.exe -m uvicorn Backend.main:app --host 0.0.0.0 --port 8000 --reload"
) else (
    start "SCYP_X Backend" cmd /k "cd /d %~dp0 && py -m uvicorn Backend.main:app --host 0.0.0.0 --port 8000 --reload"
)

echo [2/2] Starting Vite Frontend on http://localhost:5173 ...
start "SCYP_X Frontend" cmd /k "cd /d %~dp0Frontend && set PORT=5173 && npm run dev -- --host 0.0.0.0 --port 5173"

echo Waiting for services to initialize...
timeout /t 3 /nobreak >nul

echo Opening browser at http://localhost:5173 ...
start http://localhost:5173

echo.
echo Both servers are running!
echo - Frontend: http://localhost:5173
echo - Backend API: http://localhost:8000
echo - Swagger Docs: http://localhost:8000/docs
echo.
