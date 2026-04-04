import SwiftUI

/// RunFlex Watch App entry point.
@main
struct RunFlexWatchApp: App {
    @StateObject private var sessionManager = WatchSessionManager.shared
    @StateObject private var locationManager = LocationManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(sessionManager)
                .environmentObject(locationManager)
                .onAppear {
                    sessionManager.activate()
                    locationManager.requestAuthorization()
                }
        }
    }
}

/// Root content view that manages the run lifecycle.
struct ContentView: View {
    @EnvironmentObject var sessionManager: WatchSessionManager
    @EnvironmentObject var locationManager: LocationManager

    @StateObject private var workoutManager = WorkoutManager()
    @State private var navigationManager: NavigationManager?
    @State private var runPhase: RunPhase = .waiting

    enum RunPhase {
        case waiting      // No route synced
        case ready        // Route received, ready to start
        case running      // Active run with navigation
        case finished     // Run complete
    }

    var body: some View {
        Group {
            switch runPhase {
            case .waiting:
                waitingView

            case .ready:
                if let route = sessionManager.receivedRoute {
                    RouteReadyView(route: route) {
                        startRun(route: route)
                    }
                }

            case .running:
                if let route = sessionManager.receivedRoute,
                   let navManager = navigationManager {
                    TabView {
                        RunNavigationView(
                            navigationManager: navManager,
                            workoutManager: workoutManager,
                            locationManager: locationManager,
                            route: route
                        )

                        MetricsView(
                            workoutManager: workoutManager,
                            navigationManager: navManager,
                            route: route
                        )
                    }
                    .tabViewStyle(.carousel)
                }

            case .finished:
                if let route = sessionManager.receivedRoute {
                    RunCompleteView(
                        metrics: workoutManager.metrics,
                        route: route
                    ) {
                        // Send completion to iPhone
                        WatchSessionManager.shared.sendRunComplete(metrics: workoutManager.metrics)
                        runPhase = .waiting
                        sessionManager.receivedRoute = nil
                    }
                }
            }
        }
        .onReceive(sessionManager.$receivedRoute) { route in
            if route != nil && runPhase == .waiting {
                runPhase = .ready
            }
        }
        .onReceive(workoutManager.$workoutState) { state in
            if state == .finished {
                navigationManager?.stopNavigating()
                runPhase = .finished
            }
        }
        // Send live updates to iPhone every 5 seconds
        .onReceive(Timer.publish(every: 5, on: .main, in: .common).autoconnect()) { _ in
            guard runPhase == .running,
                  let loc = locationManager.currentLocation else { return }
            WatchSessionManager.shared.sendLiveUpdate(
                metrics: workoutManager.metrics,
                lat: loc.coordinate.latitude,
                lng: loc.coordinate.longitude
            )
        }
    }

    // MARK: - Waiting view

    private var waitingView: some View {
        VStack(spacing: 12) {
            Image(systemName: "applewatch.radiowaves.left.and.right")
                .font(.system(size: 36))
                .foregroundColor(.blue)

            Text("RunFlex")
                .font(.system(.headline, design: .rounded))

            Text("Open RunFlex on your iPhone and tap \"Send to Watch\" on a route.")
                .font(.system(.caption2))
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 8)
        }
    }

    // MARK: - Start run

    private func startRun(route: WatchRoute) {
        let navManager = NavigationManager(route: route, locationManager: locationManager)
        navigationManager = navManager

        workoutManager.requestAuthorization()
        locationManager.startTracking()
        workoutManager.startWorkout()
        navManager.startNavigating()

        runPhase = .running
    }
}
