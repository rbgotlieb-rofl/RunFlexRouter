#!/bin/bash
# RunFlex diagnostic script — run on your Mac to verify server health
# Usage: ./scripts/test-server.sh

set -e

API="https://runflexrouter-production.up.railway.app"
COOKIE_JAR="/tmp/runflex-test-cookies.txt"
rm -f "$COOKIE_JAR"

echo "=== RunFlex Server Diagnostics ==="
echo ""

# 1. Health check
echo "1. Health check..."
HEALTH=$(curl -s -w "\n%{http_code}" "$API/api/health" 2>&1)
HTTP_CODE=$(echo "$HEALTH" | tail -1)
BODY=$(echo "$HEALTH" | head -1)
if [ "$HTTP_CODE" = "200" ]; then
  echo "   ✅ Server is up ($BODY)"
else
  echo "   ❌ Server unreachable (HTTP $HTTP_CODE)"
  exit 1
fi

# 2. Register/login test user
echo "2. Registering test user..."
REG=$(curl -s -w "\n%{http_code}" -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -X POST "$API/api/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"test_diag_'$RANDOM'@test.com","password":"testtest123"}' 2>&1)
HTTP_CODE=$(echo "$REG" | tail -1)
BODY=$(echo "$REG" | head -1)
if [ "$HTTP_CODE" = "201" ]; then
  echo "   ✅ Registration works ($BODY)"
elif [ "$HTTP_CODE" = "409" ]; then
  echo "   ⚠️  User exists, trying login..."
  LOGIN=$(curl -s -w "\n%{http_code}" -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -X POST "$API/api/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"test_diag@test.com","password":"testtest123"}' 2>&1)
  HTTP_CODE=$(echo "$LOGIN" | tail -1)
  BODY=$(echo "$LOGIN" | head -1)
  echo "   Login: HTTP $HTTP_CODE - $BODY"
else
  echo "   ❌ Registration failed (HTTP $HTTP_CODE): $BODY"
fi

# 3. Check cookie was set
echo "3. Checking session cookie..."
if grep -q "connect.sid" "$COOKIE_JAR" 2>/dev/null; then
  COOKIE_LINE=$(grep "connect.sid" "$COOKIE_JAR")
  echo "   ✅ Cookie set: $(echo $COOKIE_LINE | awk '{print $1, $4, $5, $6}')"
  # Check SameSite and Secure flags
  if echo "$COOKIE_LINE" | grep -qi "secure"; then
    echo "   ✅ Cookie is Secure"
  else
    echo "   ⚠️  Cookie is NOT Secure (cross-origin will fail)"
  fi
else
  echo "   ❌ No session cookie set"
fi

# 4. Check auth status
echo "4. Checking auth status..."
AUTH=$(curl -s -w "\n%{http_code}" -b "$COOKIE_JAR" "$API/api/user" 2>&1)
HTTP_CODE=$(echo "$AUTH" | tail -1)
BODY=$(echo "$AUTH" | head -1)
if [ "$HTTP_CODE" = "200" ]; then
  echo "   ✅ Authenticated ($BODY)"
else
  echo "   ❌ Not authenticated (HTTP $HTTP_CODE): $BODY"
fi

# 5. Save a route
echo "5. Saving a test route..."
SAVE=$(curl -s -w "\n%{http_code}" -b "$COOKIE_JAR" \
  -X POST "$API/api/saved" \
  -H "Content-Type: application/json" \
  -d '{"name":"Diagnostic Test Route","startPoint":{"lat":51.5,"lng":-0.1},"endPoint":{"lat":51.6,"lng":-0.1},"distance":5.2}' 2>&1)
HTTP_CODE=$(echo "$SAVE" | tail -1)
BODY=$(echo "$SAVE" | head -1)
if [ "$HTTP_CODE" = "201" ]; then
  echo "   ✅ Route saved ($BODY)"
else
  echo "   ❌ Save failed (HTTP $HTTP_CODE): $BODY"
fi

# 6. Fetch saved routes
echo "6. Fetching saved routes..."
SAVED=$(curl -s -w "\n%{http_code}" -b "$COOKIE_JAR" "$API/api/saved" 2>&1)
HTTP_CODE=$(echo "$SAVED" | tail -1)
BODY=$(echo "$SAVED" | head -1)
if [ "$HTTP_CODE" = "200" ]; then
  COUNT=$(echo "$BODY" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")
  echo "   ✅ Got $COUNT saved routes"
else
  echo "   ❌ Fetch failed (HTTP $HTTP_CODE): $BODY"
fi

# 7. Generate routes
echo "7. Generating routes..."
ROUTES=$(curl -s -w "\n%{http_code}" -b "$COOKIE_JAR" \
  "$API/api/routes?startPostcode=Holmwood+Grove+London&routeMode=all" 2>&1)
HTTP_CODE=$(echo "$ROUTES" | tail -1)
BODY=$(echo "$ROUTES" | head -1)
if [ "$HTTP_CODE" = "200" ]; then
  COUNT=$(echo "$BODY" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")
  echo "   ✅ Generated $COUNT routes"
else
  echo "   ❌ Route generation failed (HTTP $HTTP_CODE): $(echo $BODY | head -c 200)"
fi

echo ""
echo "=== Done ==="
rm -f "$COOKIE_JAR"
