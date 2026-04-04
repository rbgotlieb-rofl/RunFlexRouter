import SwiftUI
import MapKit

/// Primary navigation screen during an active run.
/// Glanceable in <1 second: route line, position, direction, distance to turn.
struct RunNavigationView: View {
    @ObservedObject var navigationManager: NavigationManager
    @ObservedObject var workoutManager: WorkoutManager
    @ObservedObject var locationManager: LocationManager
    let route: WatchRoute

    var body: some View {
        ZStack {
            // Background map with route
            RouteMapView(
                route: route,
                userLocation: locationManager.currentLocation?.coordinate,
                progress: navigationManager.state.progress
            )
            .edgesIgnoringSafeArea(.all)

            // Navigation overlay
            VStack {
                // Top: turn instruction
                turnInstructionBar
                    .padding(.top, 2)

                Spacer()

                // Bottom: distance to next turn + metrics summary
                bottomBar
            }

            // Alert overlay
            if let alert = navigationManager.state.alert {
                alertOverlay(alert)
            }
        }
    }

    // MARK: - Turn instruction bar

    private var turnInstructionBar: some View {
        HStack(spacing: 8) {
            turnIcon
                .font(.system(size: 20, weight: .bold))
                .foregroundColor(.white)
                .frame(width: 32, height: 32)
                .background(navigationManager.state.isOffRoute ? Color.red : Color.blue)
                .cornerRadius(8)

            VStack(alignment: .leading, spacing: 1) {
                Text(navigationManager.state.currentInstruction)
                    .font(.system(.caption, design: .rounded).weight(.semibold))
                    .foregroundColor(.white)
                    .lineLimit(1)

                if let dist = navigationManager.state.distanceToNextTurn {
                    Text(formatDistance(dist))
                        .font(.system(.caption2, design: .rounded))
                        .foregroundColor(.white.opacity(0.8))
                }
            }

            Spacer()
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(.ultraThinMaterial.opacity(0.9))
        .cornerRadius(10)
        .padding(.horizontal, 4)
    }

    @ViewBuilder
    private var turnIcon: some View {
        if navigationManager.state.isOffRoute {
            Image(systemName: "exclamationmark.triangle.fill")
        } else if let dist = navigationManager.state.distanceToNextTurn, dist < 50 {
            Image(systemName: "arrow.turn.down.right")
        } else {
            Image(systemName: "arrow.up")
        }
    }

    // MARK: - Bottom metrics bar

    private var bottomBar: some View {
        HStack {
            // Distance to next turn (large)
            if let dist = navigationManager.state.distanceToNextTurn {
                VStack(alignment: .leading, spacing: 0) {
                    Text(formatDistance(dist))
                        .font(.system(size: 28, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                    Text("to turn")
                        .font(.system(.caption2))
                        .foregroundColor(.white.opacity(0.7))
                }
            }

            Spacer()

            // Distance traveled
            VStack(alignment: .trailing, spacing: 0) {
                Text(workoutManager.metrics.formattedDistance)
                    .font(.system(.body, design: .rounded).weight(.semibold))
                    .foregroundColor(.white)
                Text("km")
                    .font(.system(.caption2))
                    .foregroundColor(.white.opacity(0.7))
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(.ultraThinMaterial.opacity(0.85))
        .cornerRadius(12)
        .padding(.horizontal, 4)
        .padding(.bottom, 4)
    }

    // MARK: - Alert overlay

    @ViewBuilder
    private func alertOverlay(_ alert: NavigationAlert) -> some View {
        switch alert {
        case .offRoute(let metres):
            alertBanner(
                icon: "exclamationmark.triangle.fill",
                text: "Off route — \(metres)m",
                color: .red
            )
        case .turnAhead(let metres, let instruction):
            alertBanner(
                icon: "arrow.turn.down.right",
                text: "\(instruction) in \(metres)m",
                color: .blue
            )
        case .turnNow(let instruction):
            alertBanner(
                icon: "arrow.turn.down.right",
                text: instruction,
                color: .orange
            )
        case .backOnTrack:
            alertBanner(
                icon: "checkmark.circle.fill",
                text: "Back on track",
                color: .green
            )
        case .onTrack:
            alertBanner(
                icon: "checkmark.circle",
                text: "On track",
                color: .green.opacity(0.8)
            )
        }
    }

    private func alertBanner(icon: String, text: String, color: Color) -> some View {
        VStack {
            Spacer()
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .bold))
                Text(text)
                    .font(.system(.caption, design: .rounded).weight(.semibold))
            }
            .foregroundColor(.white)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(color)
            .cornerRadius(20)
            .padding(.bottom, 60)
        }
        .transition(.move(edge: .bottom).combined(with: .opacity))
        .animation(.easeInOut(duration: 0.3), value: navigationManager.state.alert)
    }

    // MARK: - Helpers

    private func formatDistance(_ metres: Double) -> String {
        if metres >= 1000 {
            return String(format: "%.1f km", metres / 1000)
        }
        return "\(Int(metres))m"
    }
}

/// Map view showing the route polyline and user position.
struct RouteMapView: View {
    let route: WatchRoute
    let userLocation: CLLocationCoordinate2D?
    let progress: Double

    @State private var region: MKCoordinateRegion = MKCoordinateRegion()

    var body: some View {
        Map(coordinateRegion: $region, showsUserLocation: true)
            .onAppear { updateRegion() }
            .onChange(of: userLocation?.latitude) { _ in updateRegion() }
    }

    private func updateRegion() {
        if let loc = userLocation {
            region = MKCoordinateRegion(
                center: loc,
                span: MKCoordinateSpan(latitudeDelta: 0.005, longitudeDelta: 0.005)
            )
        } else if let first = route.routePath.first {
            region = MKCoordinateRegion(
                center: first.clLocation,
                span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)
            )
        }
    }
}
