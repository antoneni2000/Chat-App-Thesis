# =============================================================================
# setup.ps1 - Pregatire mediu de testare pentru benchmark-urile k6
# =============================================================================
#
# CE FACE:
#   1. Inregistreaza 2 utilizatori test in backend (perfA_<timestamp>, perfB_<timestamp>)
#   2. Creeaza un chat direct intre ei
#   3. Salveaza tokenii JWT + ID-urile in perf/config.json (citit de toate scripturile k6)
#
# DE CE E NEVOIE:
#   - Toate scenariile k6 (latency.js, rest.js, scalability.js) au nevoie de un
#     chatId valid si de tokeni de autorizare. Fara aceste date, testele nu pot
#     accesa endpoint-urile protejate (Spring Security raspunde 401/403).
#
# PRECONDITII:
#   - Backend pornit pe http://localhost:8081
#   - Postgres ruleaza
#
# CUM SE RULEAZA:
#   cd perf
#   ./setup.ps1
#
# OUTPUT:
#   perf/config.json cu { tokenA, tokenB, userIdA, userIdB, chatId, wsUrl }
#
# NOTA: Tokenii JWT expira in 24h (vezi backend application.properties).
#       Daca primesti 401 la teste, ruleaza din nou setup.ps1.
# =============================================================================

$ErrorActionPreference = "Stop"
$base = "http://localhost:8081"
$suffix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$password = "Perftest123!"

function Register($name, $email) {
    $body = @{ username = $name; email = $email; password = $password; displayName = $name } | ConvertTo-Json
    Invoke-RestMethod -Uri "$base/api/auth/register" -Method POST -Body $body -ContentType "application/json"
}

$userA = Register "perfA_$suffix" "perfA_$suffix@test.local"
$userB = Register "perfB_$suffix" "perfB_$suffix@test.local"

Write-Host "User A: id=$($userA.userId) token=$($userA.token.Substring(0,20))..."
Write-Host "User B: id=$($userB.userId) token=$($userB.token.Substring(0,20))..."

# A creeaza chat direct cu B
$chatBody = @{ otherUserId = $userB.userId } | ConvertTo-Json
$chat = Invoke-RestMethod -Uri "$base/api/chats/direct" -Method POST `
    -Headers @{ Authorization = "Bearer $($userA.token)" } `
    -Body $chatBody -ContentType "application/json"

Write-Host "Chat id=$($chat.id)"

$config = @{
    tokenA    = $userA.token
    tokenB    = $userB.token
    userIdA   = $userA.userId
    userIdB   = $userB.userId
    chatId    = $chat.id
    wsUrl     = "ws://localhost:8081/ws/websocket"
    loginUser = "perfA_$suffix@test.local"
    loginPass = $password
}

$outPath = Join-Path $PSScriptRoot "config.json"
$json = $config | ConvertTo-Json
[System.IO.File]::WriteAllText($outPath, $json, (New-Object System.Text.UTF8Encoding $false))
Write-Host "Wrote $outPath"
