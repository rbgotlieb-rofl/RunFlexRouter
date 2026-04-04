import WatchKit

/// Manages haptic feedback for navigation events on Apple Watch.
final class HapticManager {
    static let shared = HapticManager()
    private init() {}

    /// Light tap — "on track" confirmation.
    func onTrack() {
        WKInterfaceDevice.current().play(.click)
    }

    /// Medium tap — turn approaching.
    func turnAhead() {
        WKInterfaceDevice.current().play(.directionUp)
    }

    /// Strong tap — turn now.
    func turnNow() {
        WKInterfaceDevice.current().play(.notification)
    }

    /// Alert pattern — off route.
    func offRoute() {
        WKInterfaceDevice.current().play(.failure)
    }

    /// Success pattern — back on track.
    func backOnTrack() {
        WKInterfaceDevice.current().play(.success)
    }

    /// Start workout confirmation.
    func workoutStarted() {
        WKInterfaceDevice.current().play(.start)
    }

    /// Stop workout confirmation.
    func workoutStopped() {
        WKInterfaceDevice.current().play(.stop)
    }
}
