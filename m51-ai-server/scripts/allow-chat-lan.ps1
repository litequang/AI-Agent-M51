$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$access = Get-Content -Raw -LiteralPath (Join-Path $root 'config/connection.local.json') | ConvertFrom-Json
try {
    $rule = Get-NetFirewallRule -Name 'M51-AI-Chat-LAN-8787' -ErrorAction SilentlyContinue
    if (-not $rule) {
        New-NetFirewallRule -Name 'M51-AI-Chat-LAN-8787' -DisplayName 'M51 AI Chat - LAN 8787' -Direction Inbound -Action Allow -Protocol TCP -LocalAddress $access.PC_LAN_IP -LocalPort 8787 -RemoteAddress $access.LAN_SUBNET -Profile Any | Out-Null
    }
    @{status='PASS';rule='M51-AI-Chat-LAN-8787';port=8787;remote_subnet=$access.LAN_SUBNET} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $root 'docs/ui-firewall-status.json') -Encoding UTF8
} catch {
    '{"status":"FAIL","detail":"Windows firewall rule could not be created"}' | Set-Content -LiteralPath (Join-Path $root 'docs/ui-firewall-status.json') -Encoding UTF8
    throw
}
