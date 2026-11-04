# Finovo Global Time Tracker - Enterprise WPF Release Build Pipeline
$ErrorActionPreference = "Stop"

$msbuild = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\msbuild.exe"
if (-not (Test-Path $msbuild)) {
    Write-Error "Microsoft MSBuild 4.8 not found at $msbuild"
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$projPath = Join-Path $root "src\Finovo.WpfTracker\FinovoTracker.csproj"
$binDir = Join-Path $root "bin"
$outExe = Join-Path $binDir "FinovoTracker.exe"
$distTarget = Join-Path $root "..\frontend\public\downloads\FinovoTracker-v2.4.1-Setup.exe"

Write-Host "Building Enterprise WPF Finovo Global Tracker (DirectX Hardware Accelerated, Pixel-Accurate UI)..." -ForegroundColor Cyan
& $msbuild $projPath /p:Configuration=Release /p:Platform=x64 /v:minimal /nologo

if ($LASTEXITCODE -ne 0) {
    Write-Error "MSBuild failed with exit code $LASTEXITCODE"
}

Write-Host "WPF Build Succeeded: $outExe" -ForegroundColor Green

# Copy to web download distribution target
$distDir = Split-Path -Parent $distTarget
if (-not (Test-Path $distDir)) {
    New-Item -ItemType Directory -Force -Path $distDir | Out-Null
}
Copy-Item -Path $outExe -Destination $distTarget -Force
Write-Host "Production Distribution Binary Placed: $distTarget" -ForegroundColor Green

# Compute SHA-256 Checksum
$hash = (Get-FileHash -Path $outExe -Algorithm SHA256).Hash.ToLower()
$fileSize = (Get-Item $outExe).Length
Write-Host "SHA-256 Checksum: $hash" -ForegroundColor Yellow
Write-Host "Binary Size: $fileSize bytes ($([Math]::Round($fileSize / 1024, 1)) KB)" -ForegroundColor Yellow

# Output object
[PSCustomObject]@{
    Executable = $outExe
    DistTarget = $distTarget
    Sha256 = $hash
    SizeBytes = $fileSize
}
