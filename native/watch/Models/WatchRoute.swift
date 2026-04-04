import Foundation
import CoreLocation

/// Lightweight route model synced from iPhone via Watch Connectivity.
struct WatchRoute: Codable, Identifiable {
    let id: Int
    let name: String
    let distance: Double          // km
    let estimatedTime: Double?    // minutes
    let routePath: [Coordinate]
    let directions: [DirectionStep]
    let syncedAt: Date

    struct Coordinate: Codable {
        let lat: Double
        let lng: Double

        var clLocation: CLLocationCoordinate2D {
            CLLocationCoordinate2D(latitude: lat, longitude: lng)
        }
    }

    struct DirectionStep: Codable {
        let instruction: String
        let distance: Double   // km
        let duration: Double   // minutes
    }
}

/// Current navigation state broadcast to views.
struct NavigationState {
    var currentStepIndex: Int = 0
    var distanceToNextTurn: Double? // metres
    var distanceTraveled: Double = 0  // km
    var isOffRoute: Bool = false
    var offRouteDistance: Double = 0   // metres
    var currentInstruction: String = ""
    var nextInstruction: String? = nil
    var progress: Double = 0  // 0-1
    var alert: NavigationAlert? = nil
}

enum NavigationAlert: Equatable {
    case turnAhead(metres: Int, instruction: String)
    case turnNow(instruction: String)
    case offRoute(metres: Int)
    case backOnTrack
    case onTrack
}

/// Run metrics collected during workout.
struct RunMetrics {
    var distanceKm: Double = 0
    var elapsedSeconds: TimeInterval = 0
    var paceMinPerKm: Double? = nil
    var heartRate: Double? = nil
    var activeCalories: Double? = nil

    var formattedPace: String {
        guard let pace = paceMinPerKm, pace > 0, pace.isFinite else { return "--:--" }
        let mins = Int(pace)
        let secs = Int((pace - Double(mins)) * 60)
        return String(format: "%d:%02d", mins, secs)
    }

    var formattedTime: String {
        let h = Int(elapsedSeconds) / 3600
        let m = (Int(elapsedSeconds) % 3600) / 60
        let s = Int(elapsedSeconds) % 60
        if h > 0 {
            return String(format: "%d:%02d:%02d", h, m, s)
        }
        return String(format: "%d:%02d", m, s)
    }

    var formattedDistance: String {
        String(format: "%.2f", distanceKm)
    }
}
