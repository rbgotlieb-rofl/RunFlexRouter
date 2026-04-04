import SwiftUI
import MapKit

/// "Ready to Run" screen shown when a route is synced and ready to start.
struct RouteReadyView: View {
    let route: WatchRoute
    let onStart: () -> Void

    private var cameraPosition: MapCameraPosition {
        let lats = route.routePath.map(\.lat)
        let lngs = route.routePath.map(\.lng)
        guard let minLat = lats.min(), let maxLat = lats.max(),
              let minLng = lngs.min(), let maxLng = lngs.max() else {
            return .automatic
        }
        let centerLat = (minLat + maxLat) / 2
        let centerLng = (minLng + maxLng) / 2
        let spanLat = (maxLat - minLat) * 1.3
        let spanLng = (maxLng - minLng) * 1.3
        return .region(MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: centerLat, longitude: centerLng),
            span: MKCoordinateSpan(latitudeDelta: max(spanLat, 0.005), longitudeDelta: max(spanLng, 0.005))
        ))
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                // Route preview map
                Map(position: .constant(cameraPosition)) { }
                .overlay(RoutePolylineOverlay(path: route.routePath))
                .frame(height: 120)
                .cornerRadius(12)
                .allowsHitTesting(false)

                // Route info
                VStack(spacing: 4) {
                    Text(route.name)
                        .font(.system(.headline, design: .rounded))
                        .lineLimit(2)
                        .multilineTextAlignment(.center)

                    HStack(spacing: 16) {
                        Label(String(format: "%.1f km", route.distance), systemImage: "figure.run")
                        if let time = route.estimatedTime {
                            Label(String(format: "%.0f min", time), systemImage: "clock")
                        }
                    }
                    .font(.system(.caption, design: .rounded))
                    .foregroundColor(.secondary)
                }

                // Start button
                Button(action: onStart) {
                    HStack {
                        Image(systemName: "play.fill")
                        Text("Start Run")
                            .fontWeight(.semibold)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                }
                .buttonStyle(.borderedProminent)
                .tint(.green)
            }
            .padding(.horizontal, 4)
        }
    }
}

/// Draws the route polyline on the map.
struct RoutePolylineOverlay: View {
    let path: [WatchRoute.Coordinate]

    var body: some View {
        GeometryReader { geo in
            if path.count >= 2 {
                let points = normalizedPoints(in: geo.size)
                Path { p in
                    p.move(to: points[0])
                    for pt in points.dropFirst() {
                        p.addLine(to: pt)
                    }
                }
                .stroke(Color.blue, lineWidth: 3)
            }
        }
    }

    private func normalizedPoints(in size: CGSize) -> [CGPoint] {
        let lats = path.map(\.lat)
        let lngs = path.map(\.lng)
        guard let minLat = lats.min(), let maxLat = lats.max(),
              let minLng = lngs.min(), let maxLng = lngs.max() else { return [] }

        let latRange = max(maxLat - minLat, 0.0001)
        let lngRange = max(maxLng - minLng, 0.0001)
        let padding: CGFloat = 12

        return path.map { coord in
            let x = padding + CGFloat((coord.lng - minLng) / lngRange) * (size.width - 2 * padding)
            let y = padding + CGFloat(1 - (coord.lat - minLat) / latRange) * (size.height - 2 * padding)
            return CGPoint(x: x, y: y)
        }
    }
}
