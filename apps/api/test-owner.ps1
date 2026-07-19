$body = @{ email = 'owner@demo.com'; password = 'password123' } | ConvertTo-Json
$login = Invoke-RestMethod -Uri http://localhost:3000/api/v1/auth/login -Method Post -Body $body -ContentType 'application/json'
$token = $login.data.access_token
$headers = @{ Authorization = "Bearer $token" }

# Get a valid menu item ID first
$menu = Invoke-RestMethod -Uri 'http://localhost:3000/api/v1/menu' -Headers $headers -Method Get
$menuItemId = $menu.data[0].id
Write-Host "Menu item: $menuItemId"

# Get an open tab
$tabs = Invoke-RestMethod -Uri 'http://localhost:3000/api/v1/tabs' -Headers $headers -Method Get
$tabId = $tabs.data[0].id
Write-Host "Tab: $tabId"

# Create order
$body2 = @{
    tabId = $tabs.data[0].id
    items = @(
        @{
            menu_item_id = $menu.data[0].id
            quantity = 2
        }
    )
} | ConvertTo-Json

$r = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/orders/tab/$($tabs.data[0].id)" -Method Post -Body $body2 -ContentType 'application/json' -Headers $headers
$orderId = $r.data[0].id
Write-Host "Created order: $orderId"

# Test approve (should work for Owner)
$r = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/orders/$orderId/approve" -Method Post -Body (@{ estimated_preparation_time_seconds = 600 } | ConvertTo-Json) -ContentType 'application/json' -Headers $headers
Write-Host "Approve (Owner): $($r.success)"

# Test decline (should work for Owner)
$body2 = @{
    tabId = $tabs.data[0].id
    items = @(
        @{
            menu_item_id = $menuItemId
            quantity = 1
        }
    )
} | ConvertTo-Json

$r2 = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/orders/tab/$($tabs.data[0].id)" -Method Post -Body $body2 -ContentType 'application/json' -Headers $headers
$orderId2 = $r2.data[0].id

$r = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/orders/$orderId2/decline" -Method Post -Body (@{ decline_reason = 'test' } | ConvertTo-Json) -ContentType 'application/json' -Headers $headers
Write-Host "Decline (Owner): $($r.success)"

# Test deliver (should work for Owner)
$r = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/orders/$orderId/deliver" -Method Post -Headers $headers
Write-Host "Deliver (Owner): $($r.success)"