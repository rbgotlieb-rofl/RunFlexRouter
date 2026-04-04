import SwiftUI
import Combine

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
        ScrollView {
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

                #if DEBUG
                Button(action: loadSampleRoute) {
                    HStack {
                        Image(systemName: "map")
                        Text("Load Sample Route")
                            .font(.system(.caption2, design: .rounded))
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(.orange)
                .padding(.top, 8)
                #endif
            }
        }
    }

    // MARK: - Sample route for testing

    #if DEBUG
    private func loadSampleRoute() {
        // A ~3km loop around Hyde Park, London
        let sampleRoute = WatchRoute(
            id: 999,
            name: "Hyde Park Loop",
            distance: 3.2,
            estimatedTime: 19,
            routePath: [
                .init(lat: 51.5073, lng: -0.1657),
                .init(lat: 51.5087, lng: -0.1630),
                .init(lat: 51.5102, lng: -0.1598),
                .init(lat: 51.5115, lng: -0.1560),
                .init(lat: 51.5120, lng: -0.1520),
                .init(lat: 51.5110, lng: -0.1485),
                .init(lat: 51.5095, lng: -0.1460),
                .init(lat: 51.5075, lng: -0.1450),
                .init(lat: 51.5055, lng: -0.1465),
                .init(lat: 51.5040, lng: -0.1495),
                .init(lat: 51.5035, lng: -0.1535),
                .init(lat: 51.5038, lng: -0.1575),
                .init(lat: 51.5048, lng: -0.1610),
                .init(lat: 51.5060, lng: -0.1640),
                .init(lat: 51.5073, lng: -0.1657),
            ],
            directions: [
                .init(instruction: "Head north on Serpentine Road", distance: 0.4, duration: 2.5),
                .init(instruction: "Turn right onto The Ring", distance: 0.5, duration: 3.0),
                .init(instruction: "Continue east along the lake", distance: 0.6, duration: 3.5),
                .init(instruction: "Turn right at South Carriage Drive", distance: 0.5, duration: 3.0),
                .init(instruction: "Turn right onto West Carriage Drive", distance: 0.6, duration: 3.5),
                .init(instruction: "Continue north to start", distance: 0.6, duration: 3.5),
            ],
            syncedAt: Date()
        )
        sessionManager.receivedRoute = sampleRoute
    }
    #endif

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
