# Apple Watch App — Native Setup

The `native/` directory contains Swift source code for the RunFlex Apple Watch app
and the Capacitor Watch Connectivity plugin. These files live outside `ios/` because
Capacitor regenerates that directory.

## Directory Structure

```
native/
├── watch/                          # watchOS app target
│   ├── RunFlexWatchApp.swift       # App entry point
│   ├── Info.plist                  # Watch app config
│   ├── Assets.xcassets/            # Watch app assets
│   ├── Models/
│   │   └── WatchRoute.swift        # Route data model
│   ├── Views/
│   │   ├── RouteReadyView.swift    # "Ready to Run" screen
│   │   ├── NavigationView.swift    # Main navigation during run
│   │   ├── MetricsView.swift       # Pace/distance/time screen
│   │   └── RunCompleteView.swift   # Post-run summary
│   └── Services/
│       ├── NavigationManager.swift # Turn-by-turn logic
│       ├── LocationManager.swift   # GPS tracking
│       ├── WorkoutManager.swift    # HealthKit workout
│       ├── HapticManager.swift     # Haptic feedback
│       └── WatchSessionManager.swift # Watch Connectivity (watch side)
└── ios-plugins/
    └── WatchConnectivity/
        ├── PhoneSessionManager.swift      # Watch Connectivity (iPhone side)
        └── WatchConnectivityPlugin.swift  # Capacitor plugin bridge
```

## Xcode Setup

1. Run `npx cap sync ios` to generate the iOS project
2. Open `ios/App/App.xcworkspace` in Xcode
3. Add a new watchOS App target: File → New → Target → watchOS → App
   - Product Name: `RunFlexWatch`
   - Bundle Identifier: `com.runflex.app.watchkitapp`
   - Interface: SwiftUI
   - Language: Swift
4. Copy files from `native/watch/` into the Watch target
5. Copy files from `native/ios-plugins/WatchConnectivity/` into the main App target
6. Add required capabilities to both targets:
   - **Watch App**: HealthKit, Background Modes (Location updates, Workout processing)
   - **iOS App**: Watch Connectivity
7. Add frameworks: WatchConnectivity, HealthKit, CoreLocation, MapKit

## Required Entitlements

### Watch App
- `com.apple.developer.healthkit`
- `com.apple.developer.healthkit.background-delivery`

### iOS App
- WatchConnectivity framework linked

## Testing

- Use a physical Apple Watch paired to your iPhone for full testing
- Simulator supports Watch Connectivity for basic message passing
- GPS navigation requires a physical device
