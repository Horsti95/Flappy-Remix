# start-dev.ps1 - starts the game server + cloudflare tunnel in one go.
# Run from the project root: powershell -ExecutionPolicy Bypass -File .\start-dev.ps1

# Set server-side env vars that Vite does not load from .env automatically
$envFile = Join-Path $PSScriptRoot ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.+)$') {
            $key = $matches[1].Trim()
            $val = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $val, "Process")
        }
    }
    Write-Host "[start-dev] Loaded .env into process environment" -ForegroundColor Green
} else {
    Write-Host "[start-dev] No .env file found - running in offline mode" -ForegroundColor Yellow
}

# Pull latest code.
#
# --ff-only on purpose: a plain `git pull` here would happily create a merge
# commit (or leave a conflicted tree) and the `2>$null` used to hide that it
# had gone wrong, so the dev server could come up on stale or half-merged code
# with no visible sign. Fast-forward or stop.
Write-Host "[start-dev] Pulling latest from git..." -ForegroundColor Cyan
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "[start-dev] git pull could not fast-forward." -ForegroundColor Red
    Write-Host "[start-dev] You have local commits or uncommitted changes on main." -ForegroundColor Yellow
    Write-Host "[start-dev] Resolve them first, or run 'npm run dev' directly to skip the pull." -ForegroundColor Yellow
    exit 1
}

# Start Vite dev server in background
Write-Host "[start-dev] Starting game server on http://localhost:5173 ..." -ForegroundColor Cyan
$vite = Start-Process -FilePath "npm" -ArgumentList "run","dev" -PassThru -NoNewWindow

# Give Vite a moment to start
Start-Sleep -Seconds 4

# Start cloudflared tunnel
Write-Host ""
Write-Host "[start-dev] Starting tunnel..." -ForegroundColor Cyan
Write-Host "[start-dev] Send the trycloudflare.com URL to your friend." -ForegroundColor Green
Write-Host "[start-dev] Press Ctrl+C to stop everything." -ForegroundColor Yellow
Write-Host ""

try {
    cloudflared tunnel --url http://localhost:5173
} finally {
    # When tunnel is stopped, also kill the Vite process
    if ($vite -and !$vite.HasExited) {
        Stop-Process -Id $vite.Id -Force -ErrorAction SilentlyContinue
        Write-Host "[start-dev] Stopped game server." -ForegroundColor Yellow
    }
}
