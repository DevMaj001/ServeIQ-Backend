param(
  [string]$BaseUrl = "https://serveiq-backend.onrender.com"
)

$ErrorActionPreference = "Stop"

function Api($method, $path, $body, $token) {
  $headers = @{ "Content-Type" = "application/json" }
  if ($token) { $headers["Authorization"] = "Bearer $token" }
  try {
    $r = Invoke-WebRequest -Uri "$BaseUrl$path" -Method $method -Body ($body | ConvertTo-Json -Depth 10 -Compress) -Headers $headers -UseBasicParsing -Verbose:$false
    return ($r.Content | ConvertFrom-Json)
  } catch {
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $errText = $reader.ReadToEnd()
    $err = $errText | ConvertFrom-Json
    $statusCode = $_.Exception.Response.StatusCode.value__
    return @{ __error = $true; statusCode = $statusCode; message = $err.meta.message -join '; ' }
  }
}

# === STEP 1: Register or Login Owner ===
Write-Host "=== STEP 1: Register Owner ===" -Fore Cyan
$owner = Api "POST" "/api/v1/auth/register" @{
  fullName      = "Matrix Owner"
  email         = "test-owner@matrix.dev"
  password      = "test1234!"
  businessName  = "Matrix Test Biz"
  businessType  = "restaurant"
}
if ($owner.__error -and $owner.statusCode -eq 409) {
  Write-Host "  Owner already exists, logging in..." -Fore Yellow
  $owner = Api "POST" "/api/v1/auth/login" @{
    email = "test-owner@matrix.dev"
    password = "test1234!"
  }
  if ($owner.__error) { throw "Owner login failed: $($owner.message)" }
} elseif ($owner.__error) {
  throw "Owner registration failed: $($owner.message)"
}
$ownerToken = $owner.data.access_token
Write-Host "  Owner token set" -Fore Green

# === STEP 2: Get Branch ID ===
Write-Host "`n=== STEP 2: Get Branch ID ===" -Fore Cyan
$branches = Api "GET" "/api/v1/branches" $null $ownerToken
$branchId = $branches.data[0].id
Write-Host "Branch ID: $branchId" -Fore Green

# === STEP 3: Create Role Users ===
Write-Host "`n=== STEP 3: Create Role Users ===" -Fore Cyan
$rolesToCreate = @(
  @{ fullName = "Test Manager";    email = "test-manager@matrix.dev";    role = "manager" }
  @{ fullName = "Test Supervisor"; email = "test-supervisor@matrix.dev"; role = "supervisor" }
  @{ fullName = "Test Waiter";     email = "test-waiter@matrix.dev";     role = "waiter" }
  @{ fullName = "Test Chef";       email = "test-chef@matrix.dev";       role = "chef" }
  @{ fullName = "Test Cashier";    email = "test-cashier@matrix.dev";    role = "cashier" }
)

$pins = @{}
foreach ($u in $rolesToCreate) {
  $resp = Api "POST" "/api/v1/user/waiters" @{
    fullName = $u.fullName
    email    = $u.email
    branchId = $branchId
    role     = $u.role
  } $ownerToken
  if ($resp.__error -and $resp.statusCode -eq 409) {
    Write-Host "  $($u.email) already exists, skipping creation" -Fore Yellow
  } elseif ($resp.__error) {
    Write-Host "  Failed to create $($u.email): $($resp.message)" -Fore Red
  } else {
    $pins[$u.role] = $resp.data.pin
    Write-Host "  Created: $($u.email) as $($u.role) (pin=$($resp.data.pin))" -Fore Green
  }
}

# === STEP 4: Login as Each Role & Set Tokens ===
Write-Host "`n=== STEP 4: Login as Each Role & Set Tokens ===" -Fore Cyan
$env:TOKEN_OWNER = $ownerToken
Write-Host "  TOKEN_OWNER set" -Fore Green

$loginMethods = @(
  @{ role = "manager";    email = "test-manager@matrix.dev";    method = "login" }
  @{ role = "supervisor"; email = "test-supervisor@matrix.dev"; method = "waiter-login" }
  @{ role = "waiter";     email = "test-waiter@matrix.dev";     method = "waiter-login" }
  @{ role = "chef";       email = "test-chef@matrix.dev";       method = "login" }
  @{ role = "cashier";    email = "test-cashier@matrix.dev";    method = "waiter-login" }
)

foreach ($u in $loginMethods) {
  $pin = $pins[$u.role]
  $varName = "TOKEN_$($u.role.ToUpper())"
  if (-not $pin) {
    Write-Host "  $varName - no PIN available (user existed before), skipping" -Fore DarkYellow
    continue
  }
  if ($u.method -eq "login") {
    $login = Api "POST" "/api/v1/auth/login" @{ email = $u.email; password = $pin } $null
  } else {
    $login = Api "POST" "/api/v1/auth/waiter-login" @{ pin = $pin; branchId = $branchId } $null
  }
  if ($login.__error) {
    Write-Host "  $varName login failed: $($login.message)" -Fore Red
  } else {
    Set-Item -Path "env:$varName" -Value $login.data.access_token
    Write-Host "  $varName set" -Fore Green
  }
}

# === STEP 5: Get Resource IDs ===
Write-Host "`n=== STEP 5: Get Resource IDs ===" -Fore Cyan
$menu = Api "GET" "/api/v1/menu" $null $ownerToken
$tabs = Api "GET" "/api/v1/tabs" $null $ownerToken
$tables = Api "GET" "/api/v1/tables" $null $ownerToken
$users = Api "GET" "/api/v1/user/waiters?role=all" $null $ownerToken

$matrixParams = @{
  BaseUrl     = $BaseUrl
  OrderId     = ""
  TabId       = if ($tabs.data.Count -gt 0) { $tabs.data[0].id } else { "" }
  TableId     = if ($tables.data.Count -gt 0) { $tables.data[0].id } else { "" }
  MenuItemId  = if ($menu.data.Count -gt 0) { $menu.data[0].id } else { "" }
  BranchId    = $branchId
  UserId      = if ($users.data.Count -gt 0) { $users.data[0].id } else { "" }
  PlanId      = ""
}

Write-Host "Resource IDs:" -Fore Yellow
$matrixParams | Format-List

# === STEP 6: Get Order ID ===
Write-Host "`n=== STEP 6: Get Order ID ===" -Fore Cyan
if (-not $matrixParams.TabId) {
  $newTab = Api "POST" "/api/v1/tabs/open" @{ table_id = $matrixParams.TableId; customer_name = "Test" } $ownerToken
  if (-not $newTab.__error) { $matrixParams.TabId = $newTab.data.id }
}
if ($matrixParams.MenuItemId -and $matrixParams.TabId) {
  $order = Api "POST" "/api/v1/orders/tab/$($matrixParams.TabId)" @(@{ menu_item_id = $matrixParams.MenuItemId; quantity = 1 }) $ownerToken
  if (-not $order.__error) { $matrixParams.OrderId = $order.data[0].id }
}

Write-Host "Final IDs:" -Fore Yellow
$matrixParams | Format-List

# === STEP 7: Run Section 15 Matrix ===
Write-Host "`n=== STEP 7: Run Section 15 Matrix ===" -Fore Cyan
& ".\section-15-matrix.ps1" @matrixParams

Write-Host "`n=== DONE ===" -Fore Cyan
