$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $projectRoot
$source = Join-Path $projectRoot "frontend"
$outputs = Join-Path $repoRoot "outputs"
$stage = Join-Path $outputs "hosting-public_html"
$zip = Join-Path $outputs "hosting-public_html.zip"

if (!(Test-Path $source)) {
  throw "Frontend folder not found: $source"
}

if (!(Test-Path $outputs)) {
  New-Item -ItemType Directory -Path $outputs | Out-Null
}

if (Test-Path $stage) {
  Remove-Item -LiteralPath $stage -Recurse -Force
}

if (Test-Path $zip) {
  Remove-Item -LiteralPath $zip -Force
}

New-Item -ItemType Directory -Path $stage | Out-Null
Copy-Item -Path (Join-Path $source "*") -Destination $stage -Recurse -Force

$htaccess = Join-Path $source ".htaccess"
if (Test-Path $htaccess) {
  Copy-Item -Path $htaccess -Destination $stage -Force
}

$zipInputs = @((Join-Path $stage "*"))
$stageHtaccess = Join-Path $stage ".htaccess"
if (Test-Path $stageHtaccess) {
  $zipInputs += $stageHtaccess
}

Compress-Archive -Path $zipInputs -DestinationPath $zip -Force

Write-Host "Frontend package created:"
Write-Host "Folder: $stage"
Write-Host "ZIP:    $zip"
Write-Host ""
Write-Host "Upload the contents of the folder to public_html or htdocs."
