#!/bin/bash
# Build and prepare iOS app for TestFlight
# Usage: ./scripts/build-ios.sh

set -e

RAILWAY_URL="https://runflexrouter-production.up.railway.app"
PLIST_PATH="ios/App/App/Info.plist"

echo "=== RunFlex iOS Build ==="

# 1. Build with VITE_API_URL set
echo "1/4  Building frontend + backend..."
VITE_API_URL="$RAILWAY_URL" npm run build

# 2. Sync to iOS
echo "2/4  Syncing Capacitor iOS project..."
npx cap sync ios

# 3. Add Info.plist location permission strings (required by Apple)
echo "3/4  Setting Info.plist location permissions..."
if [ -f "$PLIST_PATH" ]; then
  # NSLocationWhenInUseUsageDescription
  if ! /usr/libexec/PlistBuddy -c "Print :NSLocationWhenInUseUsageDescription" "$PLIST_PATH" 2>/dev/null; then
    /usr/libexec/PlistBuddy -c "Add :NSLocationWhenInUseUsageDescription string 'RunFlex needs your location to find running routes near you'" "$PLIST_PATH"
    echo "   Added NSLocationWhenInUseUsageDescription"
  else
    echo "   NSLocationWhenInUseUsageDescription already set"
  fi

  # NSLocationAlwaysAndWhenInUseUsageDescription
  if ! /usr/libexec/PlistBuddy -c "Print :NSLocationAlwaysAndWhenInUseUsageDescription" "$PLIST_PATH" 2>/dev/null; then
    /usr/libexec/PlistBuddy -c "Add :NSLocationAlwaysAndWhenInUseUsageDescription string 'RunFlex needs your location to find running routes near you'" "$PLIST_PATH"
    echo "   Added NSLocationAlwaysAndWhenInUseUsageDescription"
  else
    echo "   NSLocationAlwaysAndWhenInUseUsageDescription already set"
  fi
else
  echo "   WARNING: $PLIST_PATH not found. Run 'npx cap add ios' first."
fi

# 4. Open Xcode
echo "4/4  Opening Xcode..."
npx cap open ios

echo ""
echo "=== Build complete ==="
echo "In Xcode:"
echo "  1. Select 'Any iOS Device (arm64)' as the target"
echo "  2. Product -> Archive"
echo "  3. Distribute App -> App Store Connect -> Upload"
echo ""
