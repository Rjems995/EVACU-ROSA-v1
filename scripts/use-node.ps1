# Dot-source this script: . .\scripts\use-node.ps1
$evacuRoot = Split-Path -Parent $PSScriptRoot
$evacuNode = Get-ChildItem -LiteralPath (Join-Path $evacuRoot '.tools') -Directory -Filter 'node-*-win-x64' | Sort-Object Name -Descending | Select-Object -First 1
if (-not $evacuNode) { throw 'No project-local Node.js installation found. Install Node.js 22 or later.' }
$env:Path = "$($evacuNode.FullName);$env:Path"
Write-Host "Using Node.js from $($evacuNode.FullName)"
node --version
