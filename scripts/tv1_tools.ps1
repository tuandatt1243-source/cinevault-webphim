# CineVault TV1 — Quick Dev Verification & Run Helper (Windows PowerShell)
param(
    [switch]$Seed,
    [switch]$Test,
    [switch]$Benchmark
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Py = Join-Path $Root "backend\.venv\Scripts\python.exe"

if ($Seed) {
    Write-Host "==> Initializing MongoDB validators & indexes..." -ForegroundColor Cyan
    & $Py (Join-Path $Root "backend\scripts\init_mongo.py")
    Write-Host "==> Seeding MongoDB (Pass 1)..." -ForegroundColor Cyan
    & $Py (Join-Path $Root "backend\scripts\seed_mongo.py")
    Write-Host "==> Seeding MongoDB (Pass 2 - Idempotency Check)..." -ForegroundColor Cyan
    & $Py (Join-Path $Root "backend\scripts\seed_mongo.py")
    Write-Host "==> Caching real movie posters locally..." -ForegroundColor Cyan
    & $Py (Join-Path $Root "backend\scripts\cache_posters.py")
}

if ($Test) {
    Write-Host "==> Running Pytest Suite (Auth, RBAC, CRUD, Soft Delete, NoSQL Injection, JSON Schema)..." -ForegroundColor Cyan
    Push-Location (Join-Path $Root "backend")
    & (Join-Path $Root "backend\.venv\Scripts\pytest.exe") -v
    Pop-Location
}

if ($Benchmark) {
    Write-Host "==> Running MongoDB Benchmark (IXSCAN/TEXT vs COLLSCAN)..." -ForegroundColor Cyan
    & $Py (Join-Path $Root "backend\scripts\benchmark_mongo.py")
}

if (-not ($Seed -or $Test -or $Benchmark)) {
    Write-Host "Usage: .\scripts\tv1_tools.ps1 [-Seed] [-Test] [-Benchmark]" -ForegroundColor Yellow
}
