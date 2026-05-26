# start-dev.ps1 — starts the game server + cloudflare tunnel in one go.
# Run from the project root: .\start-dev.ps1

# Set server-side env vars that Vite doesn't load from .env automatically
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
    Write-Host "[start-dev] No .env file found — running in offline mode" -ForegroundColor Yellow
}

# Pull latest code
Write-Host "[start-dev] Pulling latest from git..." -ForegroundColor Cyan
git pull origin main 2>$null

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
