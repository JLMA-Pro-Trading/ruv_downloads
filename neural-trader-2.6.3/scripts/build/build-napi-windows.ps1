# Neural Trader - Windows-specific NAPI Build Script

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$NapiDir = Join-Path $ProjectRoot "neural-trader-rust\crates\napi-bindings"

Write-Host "Building NAPI bindings for Windows..." -ForegroundColor Cyan

# Detect architecture
$Arch = (Get-WmiObject Win32_Processor).Architecture
switch ($Arch) {
    9 { # x64
        $Target = "x86_64-pc-windows-msvc"
        $Platform = "win32-x64-msvc"
    }
    12 { # ARM64
        $Target = "aarch64-pc-windows-msvc"
        $Platform = "win32-arm64-msvc"
    }
    default {
        Write-Host "Unsupported architecture: $Arch" -ForegroundColor Red
        exit 1
    }
}

Write-Host "Target: $Target" -ForegroundColor Green

# Install target
rustup target add $Target

# Build
Set-Location $NapiDir
npm install
$env:CARGO_BUILD_TARGET = $Target
npm run build:release

# Copy binary
$BinaryName = "neural-trader.$Platform.node"
$OutputDir = Join-Path $ProjectRoot "packages\$Platform\native"
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$BinaryPath = Join-Path $ProjectRoot "neural-trader-rust\target\$Target\release\$BinaryName"
if (Test-Path $BinaryPath) {
    Copy-Item $BinaryPath $OutputDir\$BinaryName
    Write-Host "✓ Binary built: $OutputDir\$BinaryName" -ForegroundColor Green
    Get-Item "$OutputDir\$BinaryName" | Select-Object Name, Length
}
else {
    Write-Host "✗ Binary not found at: $BinaryPath" -ForegroundColor Red
    exit 1
}

# Test
Write-Host "Testing binary..." -ForegroundColor Cyan
node -e "try { require('./index.js'); console.log('✓ Binary loaded'); } catch(e) { console.error('✗ Failed:', e); process.exit(1); }"

Write-Host "✓ Windows build complete!" -ForegroundColor Green
