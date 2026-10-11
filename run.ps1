# SCYP_X Launcher Script for PowerShell
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "   Starting SCYP_X: Backend (FastAPI) + Frontend (Vite React)" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

$rootDir = if ($MyInvocation.MyCommand.Path) { Split-Path -Parent $MyInvocation.MyCommand.Path } else { (Get-Location).Path }
$pyCmd = if (Test-Path "$rootDir\.venv\Scripts\python.exe") { "$rootDir\.venv\Scripts\python.exe" } else { "py" }

# Check if Backend is already listening on port 8000
$port8000 = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' }
if (-not $port8000) {
    Write-Host "[1/2] Starting FastAPI Backend on http://localhost:8000 ..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", "Set-Location '$rootDir'; & '$pyCmd' -m uvicorn Backend.main:app --host 0.0.0.0 --port 8000 --reload"
} else {
    Write-Host "[1/2] FastAPI Backend is already running on http://localhost:8000 (PID: $($port8000[0].OwningProcess))" -ForegroundColor Cyan
}

# Check if Frontend is already listening on port 5173
$port5173 = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' }
if (-not $port5173) {
    Write-Host "[2/2] Starting Vite Frontend on http://localhost:5173 ..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", "Set-Location '$rootDir\Frontend'; `$env:PORT='5173'; npm.cmd run dev -- --host 0.0.0.0 --port 5173"
} else {
    Write-Host "[2/2] Vite Frontend is already running on http://localhost:5173 (PID: $($port5173[0].OwningProcess))" -ForegroundColor Cyan
}

Start-Sleep -Seconds 2

Write-Host "Opening default browser at http://localhost:5173 ..." -ForegroundColor Yellow
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "Both servers are live:" -ForegroundColor Green
Write-Host "  Frontend:     http://localhost:5173" -ForegroundColor White
Write-Host "  Backend API:  http://localhost:8000" -ForegroundColor White
Write-Host "  Swagger Docs: http://localhost:8000/docs" -ForegroundColor White

