#!/bin/bash
# FAQ Bot - Testing Script
# This script tests all 5 new features

API_KEY="f47151431d5a32aa086cef79ad444aad"
BASE_URL="http://localhost:3000"
SESSION_ID=$(uuidgen)

echo "=========================================="
echo "FAQ Bot - Feature Testing Script"
echo "=========================================="
echo ""
echo "Base URL: $BASE_URL"
echo "API Key: $API_KEY"
echo "Session ID: $SESSION_ID"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

function test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local needs_auth=$5

    echo -e "${YELLOW}Testing: $name${NC}"
    
    if [ "$method" = "GET" ]; then
        if [ "$needs_auth" = "true" ]; then
            response=$(curl -s -H "x-api-key: $API_KEY" -w "\n%{http_code}" "$BASE_URL$endpoint")
        else
            response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint")
        fi
    else
        if [ "$needs_auth" = "true" ]; then
            response=$(curl -s -X POST \
                -H "x-api-key: $API_KEY" \
                -H "Content-Type: application/json" \
                -d "$data" \
                -w "\n%{http_code}" \
                "$BASE_URL$endpoint")
        else
            response=$(curl -s -X POST \
                -H "Content-Type: application/json" \
                -d "$data" \
                -w "\n%{http_code}" \
                "$BASE_URL$endpoint")
        fi
    fi

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [[ $http_code =~ ^[2] ]]; then
        echo -e "${GREEN}✓ PASS (HTTP $http_code)${NC}"
        echo "Response: $body" | head -c 200
        echo ""
    else
        echo -e "${RED}✗ FAIL (HTTP $http_code)${NC}"
        echo "Response: $body" | head -c 200
        echo ""
    fi
    echo ""
}

echo "=========================================="
echo "Feature 1: API Key Guard"
echo "=========================================="
echo ""

test_endpoint "API Key Guard - Valid Key" "GET" "/admin/dashboard" "" "true"
test_endpoint "API Key Guard - Missing Key" "GET" "/admin/dashboard" "" "false"

echo "=========================================="
echo "Feature 2: Rate Limiting"
echo "=========================================="
echo ""
echo -e "${YELLOW}Note: Rate limiting applies per IP${NC}"
echo "Testing 11 requests to /admin/dashboard (should allow 10, reject 11th)"
echo ""

for i in {1..11}; do
    http_code=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "x-api-key: $API_KEY" \
        "$BASE_URL/admin/dashboard")
    if [[ $http_code =~ ^[2] ]]; then
        echo -e "${GREEN}Request $i: $http_code (allowed)${NC}"
    else
        echo -e "${RED}Request $i: $http_code (rate limited)${NC}"
    fi
done
echo ""

echo "=========================================="
echo "Feature 3: Pagination - Low Confidence Queries"
echo "=========================================="
echo ""

test_endpoint "Low Confidence - Page 1" "GET" "/admin/low-confidence?page=1&limit=20" "" "true"
test_endpoint "Low Confidence - Page 2, Limit 50" "GET" "/admin/low-confidence?page=2&limit=50" "" "true"
test_endpoint "Low Confidence - Invalid Page (0)" "GET" "/admin/low-confidence?page=0&limit=20" "" "true"
test_endpoint "Low Confidence - Invalid Limit (500)" "GET" "/admin/low-confidence?page=1&limit=500" "" "true"

echo "=========================================="
echo "Feature 4: Chat Endpoint with Conversation Memory"
echo "=========================================="
echo ""

chat_payload="{\"message\":\"What is your return policy?\"}"
test_endpoint "Chat - New Message" "POST" "/chat" "$chat_payload" "false"

chat_payload="{\"sessionId\":\"$SESSION_ID\",\"message\":\"What about shipping?\"}"
test_endpoint "Chat - With Session ID" "POST" "/chat" "$chat_payload" "false"

chat_payload="{\"sessionId\":\"$SESSION_ID\",\"message\":\"\"}"
test_endpoint "Chat - Empty Message (should fail)" "POST" "/chat" "$chat_payload" "false"

echo "=========================================="
echo "Feature 5: Category-Wise Analytics"
echo "=========================================="
echo ""

test_endpoint "Categories - All" "GET" "/admin/categories" "" "true"
test_endpoint "Categories - With Date Range" "GET" "/admin/categories?startDate=2024-02-01&endDate=2024-02-28" "" "true"
test_endpoint "Categories - Invalid Date" "GET" "/admin/categories?startDate=invalid" "" "true"

echo "=========================================="
echo "Testing Complete!"
echo "=========================================="
echo ""
echo "Summary:"
echo "✓ Feature 1 (API Key Guard) - Tests authentication"
echo "✓ Feature 2 (Rate Limiting) - Tests request limits"
echo "✓ Feature 3 (Pagination) - Tests low-confidence queries"
echo "✓ Feature 4 (Chat Endpoint) - Tests conversation memory"
echo "✓ Feature 5 (Categories) - Tests analytics"
echo ""
echo "For detailed testing instructions, see IMPLEMENTATION_GUIDE.md"
