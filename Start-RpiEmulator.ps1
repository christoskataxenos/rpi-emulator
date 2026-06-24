$setupFlag = ".setup_completed"

$dotnetCmd = "dotnet"
if (-Not (Get-Command "dotnet" -ErrorAction SilentlyContinue)) {
    if (Test-Path "C:\Program Files\dotnet\dotnet.exe") {
        $dotnetCmd = "C:\Program Files\dotnet\dotnet.exe"
    } elseif (Test-Path "$env:LOCALAPPDATA\Microsoft\dotnet\dotnet.exe") {
        $dotnetCmd = "$env:LOCALAPPDATA\Microsoft\dotnet\dotnet.exe"
    }
}

if (-Not (Test-Path $setupFlag)) {
    Write-Host "First run: Checking and installing dependencies..." -ForegroundColor Cyan

    # Check Python
    if (Get-Command "python" -ErrorAction SilentlyContinue) {
        Write-Host "Installing Python packages..." -ForegroundColor Yellow
        python -m pip install -r backend\requirements.txt
    } else {
        Write-Host "Error: Python not found. Please install Python." -ForegroundColor Red
        Pause
        exit
    }

    # Check Dotnet
    if ($dotnetCmd -eq "dotnet" -and -Not (Get-Command "dotnet" -ErrorAction SilentlyContinue)) {
        Write-Host "Error: dotnet not found. Please install .NET SDK." -ForegroundColor Red
        Pause
        exit
    }

    # Create flag file
    New-Item -ItemType File -Path $setupFlag -Force | Out-Null
    Write-Host "Setup completed successfully!" -ForegroundColor Green
} else {
    Write-Host "Dependencies are already installed. Starting..." -ForegroundColor Green
}

Write-Host "Starting .NET Desktop UI..." -ForegroundColor Cyan
Start-Process $dotnetCmd -ArgumentList "run --project desktop\RpiEmulatorDesktop.csproj" -WindowStyle Normal
