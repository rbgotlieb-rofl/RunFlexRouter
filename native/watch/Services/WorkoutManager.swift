import HealthKit
import CoreLocation
import Combine

/// Manages an outdoor running workout session on Apple Watch via HealthKit.
final class WorkoutManager: NSObject, ObservableObject {
    @Published var metrics = RunMetrics()
    @Published var workoutState: WorkoutState = .notStarted

    enum WorkoutState: Equatable {
        case notStarted, running, paused, finished
    }

    private let healthStore = HKHealthStore()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    private var timer: Timer?
    private var startDate: Date?

    private var totalDistance: Double = 0
    private var lastLocation: CLLocation?

    // MARK: - Authorization

    func requestAuthorization() {
        let typesToShare: Set<HKSampleType> = [
            HKObjectType.workoutType()
        ]
        let typesToRead: Set<HKObjectType> = [
            HKObjectType.quantityType(forIdentifier: .heartRate)!,
            HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)!,
            HKObjectType.quantityType(forIdentifier: .distanceWalkingRunning)!,
            HKObjectType.workoutType()
        ]
        healthStore.requestAuthorization(toShare: typesToShare, read: typesToRead) { _, _ in }
    }

    // MARK: - Workout lifecycle

    func startWorkout() {
        let config = HKWorkoutConfiguration()
        config.activityType = .running
        config.locationType = .outdoor

        do {
            session = try HKWorkoutSession(healthStore: healthStore, configuration: config)
            builder = session?.associatedWorkoutBuilder()
            builder?.dataSource = HKLiveWorkoutDataSource(healthStore: healthStore, workoutConfiguration: config)

            session?.delegate = self
            builder?.delegate = self

            let start = Date()
            session?.startActivity(with: start)
            builder?.beginCollection(withStart: start) { _, _ in }

            startDate = start
            workoutState = .running
            totalDistance = 0
            lastLocation = nil
            metrics = RunMetrics()

            startTimer()
            HapticManager.shared.workoutStarted()
        } catch {
            print("[WorkoutManager] Failed to start: \(error)")
        }
    }

    func pauseWorkout() {
        session?.pause()
        workoutState = .paused
        stopTimer()
    }

    func resumeWorkout() {
        session?.resume()
        workoutState = .running
        startTimer()
    }

    func endWorkout() {
        session?.end()
        stopTimer()
        workoutState = .finished
        HapticManager.shared.workoutStopped()
    }

    // MARK: - Location updates for distance

    func updateLocation(_ location: CLLocation) {
        guard workoutState == .running else { return }

        if let last = lastLocation {
            let delta = location.distance(from: last)
            // Filter out GPS jumps (> 500m between updates)
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
        let elapsed = Date().timeIntervalSince(start)
        let distKm = totalDistance / 1000
        let pace = distKm > 0.05 ? (elapsed / 60) / distKm : nil

        // Read heart rate from builder statistics
        let hrType = HKQuantityType.quantityType(forIdentifier: .heartRate)!
        let hr = builder?.statistics(for: hrType)?
            .mostRecentQuantity()?
            .doubleValue(for: HKUnit.count().unitDivided(by: .minute()))

        let calType = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned)!
        let cals = builder?.statistics(for: calType)?
            .sumQuantity()?
            .doubleValue(for: .kilocalorie())

        metrics = RunMetrics(
            distanceKm: distKm,
            elapsedSeconds: elapsed,
            paceMinPerKm: pace,
            heartRate: hr,
            activeCalories: cals
        )
    }
}

// MARK: - HKWorkoutSessionDelegate

extension WorkoutManager: HKWorkoutSessionDelegate {
    func workoutSession(_ workoutSession: HKWorkoutSession, didChangeTo toState: HKWorkoutSessionState,
                        from fromState: HKWorkoutSessionState, date: Date) {
        // State tracking handled by our own workoutState
    }

    func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        print("[WorkoutManager] Session error: \(error)")
    }
}

// MARK: - HKLiveWorkoutBuilderDelegate

extension WorkoutManager: HKLiveWorkoutBuilderDelegate {
    func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}

    func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {
        // Metrics are read in updateMetrics via timer
    }
}
