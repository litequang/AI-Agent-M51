$ErrorActionPreference = 'Stop'
$scriptPath = Join-Path $PSScriptRoot 'connect-m51.py'
python $scriptPath
Write-Host ''
Read-Host 'Press Enter to close this window'
