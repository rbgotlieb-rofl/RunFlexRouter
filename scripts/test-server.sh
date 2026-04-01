#!/bin/bash
# RunFlex diagnostic script — run on your Mac to verify server health
# Usage: ./scripts/test-server.sh
# Automatically waits for Railway to deploy the latest commit before testing.

set -e

API="https://runflexrouter-production.up.railway.app"
COOKIE_JAR="/tmp/runflex-test-cookies.txt"
rm -f "$COOKIE_JAR"

# Get the latest local commit SHA
LOCAL_SHA=$(git rev-parse HEAD | head -c 7)
echo "=== RunFlex Server Diagnostics ==="
echo "Local commit: $LOCAL_SHA"
echo ""

# Wait for Railway to deploy the latest commit
echo "0. Waiting for Railway to deploy $LOCAL_SHA..."
MAX_WAIT=180
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
  HEALTH=$(curl -s "$API/api/health" 2>/dev/null || echo '{}')
  REMOTE_SHA=$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('version','unknown')[:7])" 2>/dev/null || echo "unknown")

  if [ "$REMOTE_SHA" = "$LOCAL_SHA" ]; then
    echo "   ✅ Railway is running $LOCAL_SHA"
    break
  fi

  if [ "$REMOTE_SHA" = "unknown" ]; then
    printf "   ⏳ Server doesn't report version yet (waited %ds)...\r" $WAITED
  else
    printf "   ⏳ Railway running %s, waiting for %s (%ds)...\r" "$REMOTE_SHA" "$LOCAL_SHA" "$WAITED"
  fi
  sleep 5
  WAITED=$((WAITED + 5))
done

if [ $WAITED -ge $MAX_WAIT ]; then
  echo ""
  echo "   ⚠️  Timed out waiting for deploy. Testing against current server anyway."
fi
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
TEST_USER="test_diag_${RANDOM}@test.com"
REG=$(curl -s -w "\n%{http_code}" -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -X POST "$API/api/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${TEST_USER}\",\"password\":\"testtest123\"}" 2>&1)
HTTP_CODE=$(echo "$REG" | tail -1)
BODY=$(echo "$REG" | head -1)
if [ "$HTTP_CODE" = "201" ]; then
  echo "   ✅ Registration works ($BODY)"
else
  echo "   ❌ Registration failed (HTTP $HTTP_CODE): $BODY"
fi

# 3. Check cookie was set
echo "3. Checking session cookie..."
if grep -q "connect.sid" "$COOKIE_JAR" 2>/dev/null; then
  COOKIE_LINE=$(grep "connect.sid" "$COOKIE_JAR")
  echo "   ✅ Cookie set"
  # Check Secure flag (column 4 in Netscape cookie format)
  SECURE_FLAG=$(echo "$COOKIE_LINE" | awk '{print $4}')
  if [ "$SECURE_FLAG" = "TRUE" ]; then
    echo "   ✅ Cookie is Secure (cross-origin will work)"
  else
    echo "   ❌ Cookie is NOT Secure (cross-origin will fail for Capacitor app)"
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

# 8. Check Mapbox config
echo "8. Checking Mapbox config..."
MAPBOX=$(curl -s -w "\n%{http_code}" -b "$COOKIE_JAR" "$API/api/config" 2>&1)
HTTP_CODE=$(echo "$MAPBOX" | tail -1)
BODY=$(echo "$MAPBOX" | head -1)
if [ "$HTTP_CODE" = "200" ]; then
  HAS_TOKEN=$(echo "$BODY" | python3 -c "import sys,json; t=json.load(sys.stdin).get('mapboxToken',''); print('yes' if len(t)>10 else 'no')" 2>/dev/null || echo "?")
  if [ "$HAS_TOKEN" = "yes" ]; then
    echo "   ✅ Mapbox token configured"
  else
    echo "   ❌ Mapbox token missing or too short"
  fi
else
  echo "   ❌ Config endpoint failed (HTTP $HTTP_CODE)"
fi

# 9. Check Mapbox tiles are reachable
echo "9. Checking Mapbox tile server..."
TILE_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "https://api.mapbox.com/v4/mapbox.mapbox-streets-v8.json" 2>&1)
if [ "$TILE_CHECK" = "200" ] || [ "$TILE_CHECK" = "401" ]; then
  echo "   ✅ Mapbox API reachable"
else
  echo "   ❌ Mapbox API unreachable (HTTP $TILE_CHECK)"
fi

# 10. Verify Capacitor config
echo "10. Checking Capacitor config..."
CAP_CONFIG="capacitor.config.ts"
if [ -f "$CAP_CONFIG" ]; then
  if grep -q "CapacitorHttp" "$CAP_CONFIG"; then
    echo "   ⚠️  CapacitorHttp is enabled (may intercept map tile requests)"
  else
    echo "   ✅ No CapacitorHttp (map tiles load normally)"
  fi
  if grep -q 'server.url\|url:' "$CAP_CONFIG" | grep -q "railway"; then
    echo "   ✅ App loads from Railway (same-origin auth)"
  fi
else
  echo "   ⚠️  No capacitor.config.ts found"
fi

echo ""
echo "=== Done ==="
rm -f "$COOKIE_JAR"
