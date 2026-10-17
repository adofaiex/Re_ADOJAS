param(
    [switch]$FrameworkDependent,
    [switch]$Zip,
    [string]$Output = "$PSScriptRoot\publish"
)

$ErrorActionPreference = 'Stop'

$project = Join-Path $PSScriptRoot 'AdoFrame.csproj'
if (-not (Test-Path $project)) {
    throw "Project not found: $project"
}

$configuration = 'Release'
$selfContained = if ($FrameworkDependent) { 'false' } else { 'true' }
$outputPath = [System.IO.Path]::GetFullPath($Output)

if (Test-Path $outputPath) {
    Remove-Item $outputPath -Recurse -Force
}

$publishArgs = @(
    'publish', $project,
    '-c', $configuration,
    '-r', 'win-x64',
    '--self-contained', $selfContained,
    '-p:PublishSingleFile=true',
    '-p:IncludeNativeLibrariesForSelfExtract=true',
    '-p:EnableCompressionInSingleFile=true',
    '-p:DebugType=None',
    '-p:DebugSymbols=false',
    '-o', $outputPath
)

Write-Host "Publishing AdoFrame..." -ForegroundColor Cyan
& dotnet @publishArgs
if ($LASTEXITCODE -ne 0) {
    throw "dotnet publish failed with exit code $LASTEXITCODE"
}

$presentMon = Join-Path $outputPath 'third_party\PresentMon\PresentMon.exe'
if (-not (Test-Path $presentMon)) {
    # Single-file publish can drop content files on some SDK versions; copy them explicitly.
    $sourceThirdParty = Join-Path $PSScriptRoot 'third_party\PresentMon'
    $destThirdParty = Join-Path $outputPath 'third_party\PresentMon'
    New-Item -ItemType Directory -Force -Path $destThirdParty | Out-Null
    Copy-Item (Join-Path $sourceThirdParty '*') $destThirdParty -Force
}

if (-not (Test-Path $presentMon)) {
    throw "PresentMon.exe was not copied to the publish output."
}

$exe = Join-Path $outputPath 'AdoFrame.exe'
$size = [Math]::Round((Get-Item $exe).Length / 1MB, 1)
Write-Host ""
Write-Host "Done: $outputPath" -ForegroundColor Green
Write-Host "AdoFrame.exe: $size MB"
Write-Host "PresentMon:   $(Get-Item $presentMon | Select-Object -ExpandProperty Length) bytes"

if ($Zip) {
    $zipPath = "$outputPath.zip"
    if (Test-Path $zipPath) {
        Remove-Item $zipPath -Force
    }

    Compress-Archive -Path "$outputPath\*" -DestinationPath $zipPath -CompressionLevel Optimal
    Write-Host "Zip:          $zipPath" -ForegroundColor Green
}
