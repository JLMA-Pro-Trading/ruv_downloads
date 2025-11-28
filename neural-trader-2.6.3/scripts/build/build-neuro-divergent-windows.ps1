# Build Neuro-Divergent NAPI Binaries for Windows
# PowerShell script for Windows x64 build

param(
    [switch]$Verbose = $false
)

$ErrorActionPreference = "Stop"

# Paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$PackageDir = Join-Path $ProjectRoot "neural-trader-rust\crates\neuro-divergent"
$ArtifactsDir = Join-Path $ProjectRoot "artifacts\neuro-divergent"

# Colors
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

Write-ColorOutput "========================================" "Blue"
Write-ColorOutput "Building Neuro-Divergent for Windows" "Blue"
Write-ColorOutput "========================================" "Blue"
Write-Host ""

# Check prerequisites
function Test-Prerequisites {
    Write-ColorOutput "Checking prerequisites..." "Yellow"

    # Check Rust
    if (-not (Get-Command rustc -ErrorAction SilentlyContinue)) {
        Write-ColorOutput "✗ Rust is not installed" "Red"
        Write-Host "Install from: https://rustup.rs/"
        exit 1
    }

    # Check Node.js
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-ColorOutput "✗ Node.js is not installed" "Red"
        exit 1
    }

    # Check npm
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Write-ColorOutput "✗ npm is not installed" "Red"
        exit 1
    }

    Write-ColorOutput "✓ Prerequisites satisfied" "Green"
    Write-Host ""
}

# Install Rust target
function Install-Target {
    param([string]$Target)

    Write-ColorOutput "Installing Rust target: $Target" "Yellow"
    rustup target add $Target 2>$null

    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "✓ Target installed" "Green"
    }
    else {
        Write-ColorOutput "Target already installed" "Gray"
    }
    Write-Host ""
}

# Install npm dependencies
function Install-Dependencies {
    Write-ColorOutput "Installing npm dependencies..." "Yellow"

    Push-Location $PackageDir
    try {
        npm install
        Write-ColorOutput "✓ Dependencies installed" "Green"
    }
    finally {
        Pop-Location
    }
    Write-Host ""
}

# Build for Windows x64
function Build-WindowsX64 {
    $Target = "x86_64-pc-windows-msvc"
    $Platform = "win32-x64-msvc"

    Write-ColorOutput "Building for $Target..." "Blue"

    Push-Location $PackageDir
    try {
        # Build
        npm run build -- --target $Target --release --strip

        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✓ Build successful" "Green"

            # Find the binary
            $Binary = Get-ChildItem -Path "." -Filter "*.node" -Recurse |
                Where-Object { $_.FullName -match "target\\$Target\\release" } |
                Select-Object -First 1

            if ($Binary) {
                # Get binary size
                $SizeMB = [math]::Round($Binary.Length / 1MB, 2)
                Write-Host "  Binary size: $($SizeMB)MB"

                if ($SizeMB -gt 20) {
                    Write-ColorOutput "  ⚠️  Warning: Binary size exceeds 20MB" "Yellow"
                }

                # Copy to artifacts
                $ArtifactPath = Join-Path $ArtifactsDir "$Platform\native"
                New-Item -ItemType Directory -Force -Path $ArtifactPath | Out-Null

                $DestPath = Join-Path $ArtifactPath "neuro-divergent.$Platform.node"
                Copy-Item $Binary.FullName $DestPath -Force

                Write-ColorOutput "  ✓ Binary copied to artifacts" "Green"

                # Test the binary
                Write-Host "  Testing binary..."
                $TestScript = @"
try {
    const binding = require('$($DestPath.Replace('\', '\\'))');
    console.log('  ✓ Binary loads successfully');
    console.log('  Exports:', Object.keys(binding));
} catch(e) {
    console.error('  ✗ Failed to load:', e.message);
    process.exit(1);
}
"@

                $TestScript | node

                if ($LASTEXITCODE -eq 0) {
                    Write-ColorOutput "  ✓ Binary verified" "Green"
                }
                else {
                    Write-ColorOutput "  ✗ Binary verification failed" "Red"
                    return $false
                }
            }
            else {
                Write-ColorOutput "✗ Binary not found!" "Red"
                return $false
            }
        }
        else {
            Write-ColorOutput "✗ Build failed" "Red"
            return $false
        }
    }
    finally {
        Pop-Location
    }

    Write-Host ""
    return $true
}

# List artifacts
function Show-Artifacts {
    Write-Host ""
    Write-ColorOutput "Built Artifacts:" "Blue"
    Write-Host ""

    if (Test-Path $ArtifactsDir) {
        Get-ChildItem -Path $ArtifactsDir -Filter "*.node" -Recurse | ForEach-Object {
            $SizeMB = [math]::Round($_.Length / 1MB, 2)
            Write-Host "  $($_.Name): $($SizeMB)MB"
        }
    }
    else {
        Write-ColorOutput "No artifacts found" "Yellow"
    }

    Write-Host ""
}

# Main execution
function Main {
    try {
        Test-Prerequisites
        Install-Target "x86_64-pc-windows-msvc"
        Install-Dependencies

        if (Build-WindowsX64) {
            Show-Artifacts

            Write-ColorOutput "========================================" "Green"
            Write-ColorOutput "Build completed successfully!" "Green"
            Write-ColorOutput "========================================" "Green"

            exit 0
        }
        else {
            Write-ColorOutput "Build failed" "Red"
            exit 1
        }
    }
    catch {
        Write-ColorOutput "Error: $_" "Red"
        if ($Verbose) {
            Write-Host $_.ScriptStackTrace
        }
        exit 1
    }
}

# Run main
Main
