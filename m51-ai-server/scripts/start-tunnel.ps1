$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$runDir = Join-Path $root 'run'
$logDir = Join-Path $root 'logs'
New-Item -ItemType Directory -Force -Path $runDir, $logDir | Out-Null
$sshArgs = @('-N', '-o', 'BatchMode=yes', '-o', 'ExitOnForwardFailure=yes', '-o', 'ServerAliveInterval=30', '-o', 'ServerAliveCountMax=3', '-L', '127.0.0.1:18080:127.0.0.1:8080', 'm51-ai')
$proc = Start-Process -FilePath 'ssh.exe' -ArgumentList $sshArgs -WindowStyle Hidden -PassThru -RedirectStandardError (Join-Path $logDir 'tunnel-error.log') -RedirectStandardOutput (Join-Path $logDir 'tunnel-output.log')
Set-Content -LiteralPath (Join-Path $runDir 'tunnel.pid') -Value $proc.Id
Start-Sleep -Seconds 2
if ($proc.HasExited) { throw 'SSH tunnel exited; inspect logs/tunnel-error.log' }
Write-Host "Tunnel process started (PID $($proc.Id)); verify http://127.0.0.1:18080/health"
