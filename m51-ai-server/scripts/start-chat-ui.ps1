$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$scriptPath = Join-Path $PSScriptRoot 'chat-ui.py'
$access = Get-Content -Raw -LiteralPath (Join-Path $root 'config/connection.local.json') | ConvertFrom-Json
$proc = Start-Process -FilePath 'python.exe' -ArgumentList @('-u', $scriptPath, '--host', $access.PC_LAN_IP, '--port', '8787') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $root 'logs/chat-ui.log') -RedirectStandardError (Join-Path $root 'logs/chat-ui-error.log')
Set-Content -LiteralPath (Join-Path $root 'run/chat-ui.pid') -Value $proc.Id
Start-Sleep -Seconds 1
if ($proc.HasExited) { throw 'Chat UI failed to start; inspect logs/chat-ui-error.log' }
Write-Host "M51 chat is starting at http://$($access.PC_LAN_IP):8787"
