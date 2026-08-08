param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$OwnerToken = $env:OWNER_TOKEN,
  [string]$BranchId = $env:BRANCH_ID
)

$ErrorActionPreference = "Stop"
$passCount = 0
$failCount = 0
$totalCount = 0

function Assert-Pass {
  param([string]$Name, [scriptblock]$Action)
  $script:totalCount++
  try {
    & $Action
    Write-Host "  PASS: $Name" -ForegroundColor Green
    $script:passCount++
  } catch {
    Write-Host "  FAIL: $Name - $($_.Exception.Message)" -ForegroundColor Red
    $script:failCount++
  }
}

function Assert-Equal {
  param([object]$Actual, [object]$Expected, [string]$Message)
  if ($Actual -ne $Expected) {
    throw "Expected '$Expected' but got '$Actual'. $Message"
  }
}

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) {
    throw $Message
  }
}

function Assert-StatusCode {
  param([int]$Actual, [int]$Expected)
  Assert-Equal $Actual $Expected "HTTP status code"
}

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  ServeIQ Owner Test Suite" -ForegroundColor Cyan
Write-Host "  Base URL: $BaseUrl" -ForegroundColor Cyan
Write-Host "  Branch ID: $BranchId" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

if (-not $OwnerToken) {
  Write-Host "ERROR: OWNER_TOKEN env var or -OwnerToken param is required" -ForegroundColor Red
  exit 1
}
if (-not $BranchId) {
  Write-Host "ERROR: BRANCH_ID env var or -BranchId param is required" -ForegroundColor Red
  exit 1
}

$headers = @{
  "Authorization" = "Bearer $OwnerToken"
  "Content-Type"  = "application/json"
}

$settingsBody = @{
   settings = @{
     payment_provider           = "monniepoint"
     payment_providers          = @(
       @{ name = "manual"; type = "manual"; label = "Manual"; config = @{} },
       @{ name = "monniepoint"; type = "webhook"; label = "Moniepoint"; verification_method = "hmac-sha512"; config = @{ webhook_secret = "whsec_test_secret_key_12345" } }
     )
     monniepoint_webhook_secret = "whsec_test_secret_key_12345"
     opay_public_key            = ""
     takeaway_payment_policy    = "prepay"
   }
 } | ConvertTo-Json -Depth 5

Write-Host "`n--- Branch Settings ---" -ForegroundColor Yellow

Assert-Pass "PATCH /branches/:id/settings updates payment_provider" {
  $resp = Invoke-RestMethod -Uri "$BaseUrl/branches/$BranchId/settings" -Method Patch -Headers $headers -Body $settingsBody
  Assert-Equal $resp.settings.payment_provider "monniepoint" "payment_provider should be monniepoint"
}

Assert-Pass "PATCH /branches/:id/settings updates takeaway_payment_policy" {
  $resp = Invoke-RestMethod -Uri "$BaseUrl/branches/$BranchId/settings" -Method Patch -Headers $headers -Body $settingsBody
  Assert-Equal $resp.settings.takeaway_payment_policy "prepay" "takeaway_payment_policy should be prepay"
}

Assert-Pass "GET /branches/:id returns persisted settings" {
  $resp = Invoke-RestMethod -Uri "$BaseUrl/branches/$BranchId" -Method Get -Headers $headers
  Assert-Equal $resp.settings.payment_provider "monniepoint" "payment_provider should persist"
}

Assert-Pass "PATCH /branches/:id/settings merges with existing settings" {
   $mergeBody = @{ settings = @{ opay_public_key = "test_key_abc" } } | ConvertTo-Json -Depth 3
   $resp = Invoke-RestMethod -Uri "$BaseUrl/branches/$BranchId/settings" -Method Patch -Headers $headers -Body $mergeBody
   Assert-True ($resp.settings.monniepoint_webhook_secret -ne $null) "existing monniepoint secret preserved"
   Assert-Equal $resp.settings.opay_public_key "test_key_abc" "new opay key added"
 }

 Assert-Pass "PATCH /branches/:id/settings accepts payment_providers array" {
   $providersBody = @{ settings = @{ payment_provider = "custom-stripe"; payment_providers = @( @{ name = "custom-stripe"; type = "webhook"; label = "Custom Stripe"; verification_method = "hmac-sha512"; config = @{ webhook_secret = "whsec_stripe" } } ) } } | ConvertTo-Json -Depth 5
   $resp = Invoke-RestMethod -Uri "$BaseUrl/branches/$BranchId/settings" -Method Patch -Headers $headers -Body $providersBody
   Assert-Equal $resp.settings.payment_provider "custom-stripe" "payment_provider should be custom-stripe"
   Assert-True ($resp.settings.payment_providers -ne $null) "payment_providers array should exist"
 }

Assert-Pass "PATCH /branches/:id/settings rejects unknown branch" {
  try {
    Invoke-RestMethod -Uri "$BaseUrl/branches/00000000-0000-0000-0000-000000000000/settings" -Method Patch -Headers $headers -Body $settingsBody
    throw "Should have thrown 404"
  } catch {
    Assert-StatusCode $_.Exception.Response.StatusCode.value__ 404
  }
}

Write-Host "`n--- Moniepoint Webhook ---" -ForegroundColor Yellow

Assert-Pass "POST /webhooks/monniepoint returns received:true for missing reference" {
  $resp = Invoke-RestMethod -Uri "$BaseUrl/api/v1/public/payments/webhooks/monniepoint" -Method Post -Headers @{ "Content-Type" = "application/json" } -Body '{ "data": { "status": "SUCCESSFUL" } }'
  Assert-Equal $resp.received $true "should receive payload"
}

Assert-Pass "POST /webhooks/monniepoint returns received:true for non-successful status" {
  $resp = Invoke-RestMethod -Uri "$BaseUrl/api/v1/public/payments/webhooks/monniepoint" -Method Post -Headers @{ "Content-Type" = "application/json" } -Body '{ "data": { "reference": "ref-1", "amount": 100, "status": "FAILED" } }'
  Assert-Equal $resp.received $true "should receive payload"
}

Assert-Pass "POST /webhooks/monniepoint returns received:true when bill not found" {
  $resp = Invoke-RestMethod -Uri "$BaseUrl/api/v1/public/payments/webhooks/monniepoint" -Method Post -Headers @{ "Content-Type" = "application/json" } -Body '{ "data": { "reference": "NONEXISTENT", "amount": 100, "status": "SUCCESSFUL" } }'
  Assert-Equal $resp.received $true "should receive payload"
  Assert-Equal $resp.error "Bill not found" "should have error message"
}

Assert-Pass "POST /webhooks/monniepoint rejects invalid HMAC signature" {
  try {
    Invoke-RestMethod -Uri "$BaseUrl/api/v1/public/payments/webhooks/monniepoint" -Method Post -Headers @{ "Content-Type" = "application/json"; "x-moniepoint-signature" = "wrong-sig" } -Body '{ "data": { "reference": "ref-1", "amount": 100, "status": "SUCCESSFUL" } }'
    throw "Should have thrown 403"
  } catch {
    Assert-StatusCode $_.Exception.Response.StatusCode.value__ 403
  }
}

Assert-Pass "POST /webhooks/monniepoint returns already_paid when bill is paid" {
  $resp = Invoke-RestMethod -Uri "$BaseUrl/api/v1/public/payments/webhooks/monniepoint" -Method Post -Headers @{ "Content-Type" = "application/json"; "x-moniepoint-signature" = "sig" } -Body '{ "data": { "reference": "ref-1", "amount": 100, "status": "SUCCESSFUL" } }'
  Assert-Equal $resp.status "already_paid" "should indicate already paid"
}

Assert-Pass "POST /webhooks/monniepoint calls processPayment with POS method" {
  $resp = Invoke-RestMethod -Uri "$BaseUrl/api/v1/public/payments/webhooks/monniepoint" -Method Post -Headers @{ "Content-Type" = "application/json"; "x-moniepoint-signature" = "sig" } -Body '{ "data": { "reference": "ref-1", "amount": 150000, "status": "SUCCESSFUL", "terminalId": "term-1" } }'
  Assert-Equal $resp.status "processed" "should process payment"
}

Write-Host "`n--- OPay Webhook ---" -ForegroundColor Yellow

Assert-Pass "POST /webhooks/opay returns received:true for missing reference" {
  $resp = Invoke-RestMethod -Uri "$BaseUrl/api/v1/public/payments/webhooks/opay" -Method Post -Headers @{ "Content-Type" = "application/json" } -Body '{ "data": { "status": "SUCCESS" } }'
  Assert-Equal $resp.received $true "should receive payload"
}

Assert-Pass "POST /webhooks/opay returns received:true for non-successful status" {
  $resp = Invoke-RestMethod -Uri "$BaseUrl/api/v1/public/payments/webhooks/opay" -Method Post -Headers @{ "Content-Type" = "application/json" } -Body '{ "data": { "reference": "ref-1", "amount": 100, "status": "FAILED" } }'
  Assert-Equal $resp.received $true "should receive payload"
}

Assert-Pass "POST /webhooks/opay calls processPayment with POS method" {
  $resp = Invoke-RestMethod -Uri "$BaseUrl/api/v1/public/payments/webhooks/opay" -Method Post -Headers @{ "Content-Type" = "application/json" } -Body '{ "data": { "reference": "ref-1", "amount": 50000, "status": "SUCCESS", "transactionType": "POS" } }'
  Assert-Equal $resp.status "processed" "should process payment"
}

Assert-Pass "POST /webhooks/opay calls processPayment with TRANSFER method" {
  $resp = Invoke-RestMethod -Uri "$BaseUrl/api/v1/public/payments/webhooks/opay" -Method Post -Headers @{ "Content-Type" = "application/json" } -Body '{ "data": { "reference": "ref-1", "amount": 50000, "status": "SUCCESS", "transactionType": "TRANSFER" } }'
  Assert-Equal $resp.status "processed" "should process payment"
}

Write-Host "`n--- Summary ---" -ForegroundColor Cyan
Write-Host "  Total: $totalCount" -ForegroundColor White
Write-Host "  Pass:  $passCount" -ForegroundColor Green
Write-Host "  Fail:  $failCount" -ForegroundColor Red

if ($failCount -gt 0) {
  Write-Host "`nSome tests FAILED" -ForegroundColor Red
  exit 1
} else {
  Write-Host "`nAll tests PASSED" -ForegroundColor Green
  exit 0
}