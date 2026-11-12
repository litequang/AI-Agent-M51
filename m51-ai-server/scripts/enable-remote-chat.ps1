$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$access = Get-Content -Raw -LiteralPath (Join-Path $root 'config/connection.local.json') | ConvertFrom-Json
$tailscale = Join-Path $env:ProgramFiles 'Tailscale/tailscale.exe'
$state = (& $tailscale status --json | ConvertFrom-Json)
if ($state.BackendState -ne 'Running') { throw 'Sign in to Tailscale first' }
$target = "tcp://$($access.PC_LAN_IP):8787"
$current = (& $tailscale serve status --json | ConvertFrom-Json)
if ($current.TCP.'8787' -and $current.TCP.'8787'.TCPForward -ne "$($access.PC_LAN_IP):8787") {
    throw 'Port 8787 already serves another target; inspect before changing'
}
$health = Invoke-RestMethod -Uri "http://$($access.PC_LAN_IP):8787/api/status" -TimeoutSec 10
if (-not $health.ready) { throw 'Start the M51 chat backend and API tunnel first' }
& $tailscale serve --bg --tcp=8787 $target
if ($LASTEXITCODE -ne 0) { throw 'Tailscale Serve failed' }
$tailnetIp = @($state.TailscaleIPs | Where-Object { $_ -notmatch ':' })[0]
Write-Host ("Private chat: http://{0}:8787" -f $tailnetIp)
Write-Host 'Clients must join the authorized tailnet. Keep this PC and M51 online.'
Write-Host 'Disable only this mapping: tailscale serve --tcp=8787 off'
