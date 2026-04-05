import CoreLocation
import Combine

/// Manages run tracking on Apple Watch.
/// Uses basic timer + GPS distance tracking.
/// HealthKit workout integration can be added once the entitlement is configured.
final class WorkoutManager: NSObject, ObservableObject {
    @Published var metrics = RunMetrics()
    @Published var workoutState: WorkoutState = .notStarted

    enum WorkoutState: Equatable {
        case notStarted, running, paused, finished
    }

    private var timer: Timer?
    private var startDate: Date?
    private var pausedDuration: TimeInterval = 0
    private var pauseStart: Date?

    private var totalDistance: Double = 0
    private var lastLocation: CLLocation?

    // MARK: - Workout lifecycle

    func requestAuthorization() {
        // No-op for now; add HealthKit auth here once entitlement is configured
    }

    func startWorkout() {
        startDate = Date()
        pausedDuration = 0
        workoutState = .running
        totalDistance = 0
        lastLocation = nil
        metrics = RunMetrics()
        startTimer()
    }

    func pauseWorkout() {
        pauseStart = Date()
        workoutState = .paused
        stopTimer()
    }

    func resumeWorkout() {
        if let ps = pauseStart {
            pausedDuration += Date().timeIntervalSince(ps)
        }
        pauseStart = nil
        workoutState = .running
        startTimer()
    }

    func endWorkout() {
        if let ps = pauseStart {
            pausedDuration += Date().timeIntervalSince(ps)
        }
        stopTimer()
        updateMetrics()
        workoutState = .finished
    }

    // MARK: - Location updates for distance

    func updateLocation(_ location: CLLocation) {
        guard workoutState == .running else { return }

        if let last = lastLocation {
            let delta = location.distance(from: last)
            if delta > 3 && delta < 500 && location.horizontalAccuracy < 50 {
                totalDistance += delta
            }
        }
        lastLocation = location
    }

    // MARK: - Timer

    private func startTimer() {
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            self?.updateMetrics()
        }
    }

    private func stopTimer() {
        timer?.invalidate()
        timer = nil
    }

    private func updateMetrics() {
        guard let start = startDate else { return }
        let elapsed = Date().timeIntervalSince(start) - pausedDuration
        let distKm = totalDistance / 1000
        let pace = distKm > 0.05 ? (elapsed / 60) / distKm : nil

        metrics = RunMetrics(
            distanceKm: distKm,
            elapsedSeconds: elapsed,
            paceMinPerKm: pace,
            heartRate: nil,
            activeCalories: nil
        )
    }
}
