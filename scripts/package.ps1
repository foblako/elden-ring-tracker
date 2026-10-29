# Elden Ring Tracker Release Packaging Script
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Building Elden Ring Tracker Distribution " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$baseDir = Split-Path -Parent $PSScriptRoot
Set-Location $baseDir

# 1. Build Client UI
Write-Host "[1/5] Building React client..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { throw "Build failed!" }

# 2. Bundle Server
Write-Host "[2/5] Bundling standalone server..." -ForegroundColor Yellow
npx esbuild server/index.ts --bundle --platform=node --target=node18 --outfile=server/server.bundle.cjs
if ($LASTEXITCODE -ne 0) { throw "Server bundle failed!" }

# 3. Compile RAM Tracker & Launcher
Write-Host "[3/5] Compiling C# executables..." -ForegroundColor Yellow
$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
& $csc /nologo /optimize+ /target:exe /out:tools\er_tracker.exe tools\er_tracker\Program.cs
& $csc /nologo /optimize+ /target:exe /out:launcher\EldenRingTracker.exe launcher\Program.cs

# 4. Assemble release folder
Write-Host "[4/5] Assembling release package..." -ForegroundColor Yellow
$relRoot = "$baseDir\release"
$relDir = "$relRoot\EldenRingTracker-v1.0.0-Windows"

if (Test-Path $relDir) { Remove-Item -Recurse -Force $relDir }
New-Item -ItemType Directory -Path $relDir -Force | Out-Null
New-Item -ItemType Directory -Path "$relDir\tools" -Force | Out-Null

Copy-Item "launcher\EldenRingTracker.exe" "$relDir\"
Copy-Item "server\server.bundle.cjs" "$relDir\"
Copy-Item "C:\Program Files\nodejs\node.exe" "$relDir\"
Copy-Item -Recurse "dist" "$relDir\"
Copy-Item "tools\er_tracker.exe" "$relDir\tools\"

# 5. Create ZIP Archive
Write-Host "[5/5] Compressing ZIP archive..." -ForegroundColor Yellow
$zipPath = "$relRoot\EldenRingTracker-v1.0.0-Windows.zip"
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
Compress-Archive -Path $relDir -DestinationPath $zipPath -Force

$zipSize = (Get-Item $zipPath).Length / 1MB
Write-Host "==========================================" -ForegroundColor Green
Write-Host " SUCCESS! Release ready: $zipPath " -ForegroundColor Green
Write-Host (" Archive Size: {0:N1} MB" -f $zipSize) -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
