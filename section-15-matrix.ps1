# Section 15: Permission Regression Matrix
# Usage (run once per role token):
#   $env:TOKEN_OWNER = "..."
#   $env:TOKEN_MANAGER = "..."
#   ./section-15-matrix.ps1

param(
  [string]$BaseUrl = "https://serveiq-backend.onrender.com",
  # Fill in resource IDs from your database
  [string]$OrderId = "",
  [string]$TabId = "",
  [string]$TableId = "",
  [string]$MenuItemId = "",
  [string]$BranchId = "",
  [string]$UserId = "",
  [string]$PlanId = ""
)

# Roles being tested
$Roles = @("owner", "manager", "supervisor", "waiter", "chef", "cashier")

# Matrix: Endpoint -> expected status per role
# 200 = should succeed for this role, 403 = should be forbidden
$Matrix = @(
  # ─── ORDERS ───
  @{ Path = "POST /api/v1/orders/$OrderId/approve";  owner = 200; manager = 403; supervisor = 200; waiter = 403; chef = 403; cashier = 403 },
  @{ Path = "POST /api/v1/orders/$OrderId/decline";  owner = 200; manager = 200; supervisor = 200; waiter = 403; chef = 403; cashier = 403 },
  @{ Path = "POST /api/v1/orders/$OrderId/deliver";  owner = 200; manager = 200; supervisor = 200; waiter = 403; chef = 403; cashier = 403 },

  # ─── TABS ───
  @{ Path = "POST /api/v1/tabs/$TabId/close";        owner = 200; manager = 200; supervisor = 200; waiter = 403; chef = 403; cashier = 403 },
  @{ Path = "POST /api/v1/tabs/$TabId/void";         owner = 200; manager = 200; supervisor = 200; waiter = 403; chef = 403; cashier = 403 },
  @{ Path = "POST /api/v1/tabs/$TabId/transfer";     owner = 200; manager = 200; supervisor = 200; waiter = 403; chef = 403; cashier = 403 },

  # ─── SUBSCRIPTIONS ───
  @{ Path = "POST /api/v1/subscriptions/cancel";      owner = 200; manager = 403; supervisor = 403; waiter = 403; chef = 403; cashier = 403 },

  # ─── INVENTORY ───
  @{ Path = "POST /api/v1/ingredients";              owner = 200; manager = 200; supervisor = 403; waiter = 403; chef = 403; cashier = 403 },

  # ─── SUPPLIERS ───
  @{ Path = "POST /api/v1/suppliers";                owner = 200; manager = 200; supervisor = 403; waiter = 403; chef = 403; cashier = 403 },

  # ─── TABLE MANAGEMENT ───
  @{ Path = "POST /api/v1/tables";                   owner = 200; manager = 200; supervisor = 403; waiter = 403; chef = 403; cashier = 403 },
  @{ Path = "DELETE /api/v1/tables/$TableId";        owner = 200; manager = 200; supervisor = 403; waiter = 403; chef = 403; cashier = 403 },

  # ─── MENU ───
  @{ Path = "POST /api/v1/menu";                     owner = 200; manager = 200; supervisor = 403; waiter = 403; chef = 403; cashier = 403 },
  @{ Path = "DELETE /api/v1/menu/$MenuItemId";       owner = 200; manager = 200; supervisor = 403; waiter = 403; chef = 403; cashier = 403 },

  # ─── BILLING ───
  @{ Path = "POST /api/v1/bills/tab/$TabId/apply-discount"; owner = 200; manager = 200; supervisor = 200; waiter = 403; chef = 403; cashier = 403 },

  # ─── USERS ───
  @{ Path = "DELETE /api/v1/user/$UserId";           owner = 200; manager = 200; supervisor = 403; waiter = 403; chef = 403; cashier = 403 },
  @{ Path = "POST /api/v1/user/$UserId/deactivate";  owner = 200; manager = 200; supervisor = 403; waiter = 403; chef = 403; cashier = 403 },

  # ─── BRANCHES ───
  @{ Path = "DELETE /api/v1/branches/$BranchId";     owner = 200; manager = 403; supervisor = 403; waiter = 403; chef = 403; cashier = 403 },

  # ─── BUSINESS ───
  @{ Path = "PUT /api/v1/businesses/me";             owner = 200; manager = 403; supervisor = 403; waiter = 403; chef = 403; cashier = 403 }
)

# Colors
$passColor = "Green"
$failColor = "Red"
$skipColor = "DarkYellow"

Write-Host "`n============================================" -Fore Cyan
Write-Host "  SECTION 15: PERMISSION REGRESSION MATRIX" -Fore Cyan
Write-Host "============================================" -Fore Cyan

$global:Pass = 0
$global:Fail = 0
$global:Skip = 0

foreach ($role in $Roles) {
  $token = [System.Environment]::GetEnvironmentVariable("TOKEN_$($role.ToUpper())")
  if (-not $token) {
    Write-Host "`n[SKIP] No token for $role (set `$env:TOKEN_$($role.ToUpper()))" -Fore $skipColor
    $global:Skip += ($Matrix | Where-Object { $_[$role] -ne $null }).Count
    continue
  }

  $headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }
  Write-Host "`n─── Testing as: $role ───" -Fore Yellow

  foreach ($row in $Matrix) {
    $parts = $row.Path -split ' ', 2
    $method = $parts[0]
    $path = $parts[1]
    $expected = $row[$role]

    if ($expected -eq $null) { $expected = 403 }  # default deny

    $url = "$BaseUrl$path"
    try {
      $resp = Invoke-WebRequest -Uri $url -Method $method -Headers $headers -ErrorAction Stop
      $actual = [int]$resp.StatusCode
    } catch {
      $actual = [int]$_.Exception.Response.StatusCode.value__
    }

    $statusSymbol = if ($actual -eq $expected) { "+" } else { "x" }
    $statusColor = if ($actual -eq $expected) { $passColor } else { $failColor }

    Write-Host "  [$statusSymbol] $($row.Path)" -Fore $statusColor
    Write-Host "        expected: $expected | actual: $actual" -Fore $statusColor

    if ($actual -eq $expected) { $global:Pass++ } else { $global:Fail++ }
  }
}

Write-Host "`n============================================" -Fore Cyan
Write-Host "  RESULTS: $($global:Pass) passed / $($global:Fail) failed / $($global:Skip) skipped" -Fore $(if ($global:Fail -eq 0) { $passColor } else { $failColor })
Write-Host "============================================" -Fore Cyan
