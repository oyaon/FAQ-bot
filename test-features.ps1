# FAQ Bot - Testing Script (PowerShell Windows)
# This script tests all 5 new features

$API_KEY = "f47151431d5a32aa086cef79ad444aad"
$BASE_URL = "http://localhost:3000"
$SESSION_ID = [guid]::NewGuid().ToString()

Write-Host "=========================================="
Write-Host "FAQ Bot - Feature Testing Script"
Write-Host "=========================================="
Write-Host ""
Write-Host "Base URL: $BASE_URL"
Write-Host "API Key: $API_KEY"
Write-Host "Session ID: $SESSION_ID"
Write-Host ""

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Endpoint,
        [string]$Body,
        [bool]$NeedsAuth
    )

    Write-Host "Testing: $Name" -ForegroundColor Yellow
    
    $url = "$BASE_URL$Endpoint"
    $headers = @{}
    
    if ($NeedsAuth) {
        $headers["x-api-key"] = $API_KEY
    }

    try {
        if ($Method -eq "GET") {
            $response = Invoke-WebRequest -Uri $url -Headers $headers -Method GET -UseBasicParsing -ErrorAction SilentlyContinue
        }
        else {
            $response = Invoke-WebRequest -Uri $url -Headers $headers -Method POST -ContentType "application/json" -Body $Body -UseBasicParsing -ErrorAction SilentlyContinue
        }

        $httpCode = $response.StatusCode
        $content = $response.Content | ConvertFrom-Json | ConvertTo-Json -Compress

        if ($httpCode -lt 400) {
            Write-Host "PASS (HTTP $httpCode)" -ForegroundColor Green
            Write-Host "Response: $($content.Substring(0, [math]::Min(200, $content.Length)))"
        }
        else {
            Write-Host "FAIL (HTTP $httpCode)" -ForegroundColor Red
            Write-Host "Response: $($content.Substring(0, [math]::Min(200, $content.Length)))"
        }
    }
    catch {
        $httpCode = $_.Exception.Response.StatusCode.Value__
        Write-Host "FAIL (HTTP $httpCode)" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)"
    }
    
    Write-Host ""
}

Write-Host "=========================================="
Write-Host "Feature 1: API Key Guard"
Write-Host "=========================================="
Write-Host ""

Test-Endpoint "API Key Guard - Valid Key" "GET" "/admin/dashboard" "" $true
Test-Endpoint "API Key Guard - Missing Key" "GET" "/admin/dashboard" "" $false

Write-Host "=========================================="
Write-Host "Feature 2: Rate Limiting"
Write-Host "=========================================="
Write-Host ""
Write-Host "Note: Rate limiting applies per IP (configured for 30 req/min)" -ForegroundColor Yellow
Write-Host "Testing 31 requests to /admin/dashboard (should allow 30, reject 31st)"
Write-Host ""

for ($i = 1; $i -le 31; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "$BASE_URL/admin/dashboard" -Headers @{"x-api-key" = $API_KEY} -Method GET -UseBasicParsing -ErrorAction SilentlyContinue
        $httpCode = $response.StatusCode
    }
    catch {
        $httpCode = $_.Exception.Response.StatusCode.Value__
    }

    if ($httpCode -lt 400) {
        Write-Host "Request $i : $httpCode (allowed)" -ForegroundColor Green
    }
    else {
        Write-Host "Request $i : $httpCode (rate limited)" -ForegroundColor Red
    }
}
Write-Host ""

Write-Host "=========================================="
Write-Host "Feature 3: Pagination - Low Confidence Queries"
Write-Host "=========================================="
Write-Host ""

Test-Endpoint "Low Confidence - Page 1" "GET" "/admin/low-confidence?page=1&limit=20" "" $true
Test-Endpoint "Low Confidence - Page 2, Limit 50" "GET" "/admin/low-confidence?page=2&limit=50" "" $true
Test-Endpoint "Low Confidence - Invalid Page (0)" "GET" "/admin/low-confidence?page=0&limit=20" "" $true
Test-Endpoint "Low Confidence - Invalid Limit (500)" "GET" "/admin/low-confidence?page=1&limit=500" "" $true

Write-Host "=========================================="
Write-Host "Feature 4: Chat Endpoint with Conversation Memory"
Write-Host "=========================================="
Write-Host ""

$chatPayload = @{"message" = "What is your return policy?" } | ConvertTo-Json
Test-Endpoint "Chat - New Message" "POST" "/chat" $chatPayload $false

$chatPayload = @{"sessionId" = $SESSION_ID; "message" = "What about shipping?" } | ConvertTo-Json
Test-Endpoint "Chat - With Session ID" "POST" "/chat" $chatPayload $false

$chatPayload = @{"sessionId" = $SESSION_ID; "message" = "" } | ConvertTo-Json
Test-Endpoint "Chat - Empty Message (should fail)" "POST" "/chat" $chatPayload $false

Write-Host "=========================================="
Write-Host "Feature 5: Category-Wise Analytics"
Write-Host "=========================================="
Write-Host ""

Test-Endpoint "Categories - All" "GET" "/admin/categories" "" $true
Test-Endpoint "Categories - With Date Range" "GET" "/admin/categories?startDate=2024-02-01%26endDate=2024-02-28" "" $true
Test-Endpoint "Categories - Invalid Date" "GET" "/admin/categories?startDate=invalid" "" $true

Write-Host "=========================================="
Write-Host "Testing Complete!"
Write-Host "=========================================="
Write-Host ""
Write-Host "Summary:"
Write-Host "Feature 1 (API Key Guard) - Tests authentication"
Write-Host "Feature 2 (Rate Limiting) - Tests request limits"
Write-Host "Feature 3 (Pagination) - Tests low-confidence queries"
Write-Host "Feature 4 (Chat Endpoint) - Tests conversation memory"
Write-Host "Feature 5 (Categories) - Tests analytics"
Write-Host ""
Write-Host "For detailed testing instructions, see IMPLEMENTATION_GUIDE.md"

