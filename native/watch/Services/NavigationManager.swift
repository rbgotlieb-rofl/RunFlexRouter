import CoreLocation
import Combine

/// Manages turn-by-turn navigation logic on Apple Watch.
/// Ported from the web app's `use-navigation.ts` hook.
final class NavigationManager: ObservableObject {
    @Published var state = NavigationState()

    private let route: WatchRoute
    private let locationManager: LocationManager
    private var cancellable: AnyCancellable?

    // Thresholds
    private let offRouteThresholdMetres: Double = 30    // tighter for watch
    private let turnAlertMetres: Double = 100           // alert at 100m
    private let turnImminentMetres: Double = 30         // turn now at 30m
    private let onTrackReminderInterval: TimeInterval = 180 // every 3 min

    private var lastAlertStepIndex: Int = -1
    private var lastImminentStepIndex: Int = -1
    private var lastOffRouteAlerted: Bool = false
    private var lastOnTrackReminder: Date = .distantPast

    init(route: WatchRoute, locationManager: LocationManager) {
        self.route = route
        self.locationManager = locationManager
    }

    func startNavigating() {
        cancellable = locationManager.$currentLocation
            .compactMap { $0 }
            .sink { [weak self] location in
                self?.updateNavigation(with: location)
            }
    }

    func stopNavigating() {
        cancellable?.cancel()
        cancellable = nil
    }

    // MARK: - Core navigation logic

    private func updateNavigation(with location: CLLocation) {
        let path = route.routePath
        let directions = route.directions
        guard path.count >= 2, !directions.isEmpty else { return }

        let userCoord = location.coordinate
        let nearest = findNearestRoutePoint(userCoord, in: path)
        let distAlongRoute = cumulativeDistance(in: path, upTo: nearest.index)
        let offRouteMetres = nearest.distanceMetres
        let isOffRoute = offRouteMetres > offRouteThresholdMetres

        let stepIdx = findCurrentStep(distAlongRoute: distAlongRoute, directions: directions)
        let distToTurn = distanceToEndOfStep(distAlongRoute: distAlongRoute, stepIndex: stepIdx, directions: directions)
        let distToTurnMetres = distToTurn * 1000

        let currentStep = directions[stepIdx]
        let nextStep = stepIdx + 1 < directions.count ? directions[stepIdx + 1] : nil

        var alert: NavigationAlert? = nil

        // Off-route alert
        if isOffRoute {
            let metres = Int(offRouteMetres)
            alert = .offRoute(metres: metres)
            if !lastOffRouteAlerted {
                HapticManager.shared.offRoute()
                lastOffRouteAlerted = true
            }
        }
        // Back on track
        else if lastOffRouteAlerted {
            alert = .backOnTrack
            HapticManager.shared.backOnTrack()
            lastOffRouteAlerted = false
        }
        // Turn approaching (100m)
        else if distToTurnMetres <= turnAlertMetres,
                let next = nextStep,
                lastAlertStepIndex != stepIdx {
            let metres = Int(distToTurnMetres)
            alert = .turnAhead(metres: metres, instruction: next.instruction)
            HapticManager.shared.turnAhead()
            lastAlertStepIndex = stepIdx
        }
        // Turn imminent (30m)
        else if distToTurnMetres <= turnImminentMetres,
                let next = nextStep,
                lastImminentStepIndex != stepIdx {
            alert = .turnNow(instruction: next.instruction)
            HapticManager.shared.turnNow()
            lastImminentStepIndex = stepIdx
        }
        // Periodic "on track" confidence boost
        else if Date().timeIntervalSince(lastOnTrackReminder) > onTrackReminderInterval {
            alert = .onTrack
            HapticManager.shared.onTrack()
            lastOnTrackReminder = Date()
        }

        let totalDistance = route.distance
        let progress = totalDistance > 0 ? min(1, distAlongRoute / totalDistance) : 0

        state = NavigationState(
            currentStepIndex: stepIdx,
            distanceToNextTurn: distToTurnMetres,
            distanceTraveled: distAlongRoute,
            isOffRoute: isOffRoute,
            offRouteDistance: offRouteMetres,
            currentInstruction: currentStep.instruction,
            nextInstruction: nextStep?.instruction,
            progress: progress,
            alert: alert
        )
    }

    // MARK: - Geometry helpers

    private func haversineMetres(_ lat1: Double, _ lng1: Double, _ lat2: Double, _ lng2: Double) -> Double {
        let toRad = { (d: Double) -> Double in d * .pi / 180 }
        let R = 6_371_000.0 // Earth radius in metres
        let dLat = toRad(lat2 - lat1)
        let dLng = toRad(lng2 - lng1)
        let a = sin(dLat / 2) * sin(dLat / 2) +
                cos(toRad(lat1)) * cos(toRad(lat2)) *
                sin(dLng / 2) * sin(dLng / 2)
        return 2 * R * asin(sqrt(a))
    }

    private func findNearestRoutePoint(
        _ coord: CLLocationCoordinate2D,
        in path: [WatchRoute.Coordinate]
    ) -> (index: Int, distanceMetres: Double) {
        var minDist = Double.greatestFiniteMagnitude
        var minIdx = 0
        for (i, point) in path.enumerated() {
            let d = haversineMetres(coord.latitude, coord.longitude, point.lat, point.lng)
            if d < minDist {
                minDist = d
                minIdx = i
            }
        }
        return (minIdx, minDist)
    }

    private func cumulativeDistance(in path: [WatchRoute.Coordinate], upTo index: Int) -> Double {
        var dist = 0.0
        for i in 1...min(index, path.count - 1) {
            dist += haversineMetres(path[i - 1].lat, path[i - 1].lng, path[i].lat, path[i].lng)
        }
        return dist / 1000 // return km
    }

    private func findCurrentStep(
        distAlongRoute: Double,
        directions: [WatchRoute.DirectionStep]
    ) -> Int {
        var cumDist = 0.0
        for (i, step) in directions.enumerated() {
            cumDist += step.distance
            if distAlongRoute < cumDist { return i }
        }
        return directions.count - 1
    }

    private func distanceToEndOfStep(
        distAlongRoute: Double,
        stepIndex: Int,
        directions: [WatchRoute.DirectionStep]
    ) -> Double {
        var cumDist = 0.0
        for i in 0...stepIndex {
            cumDist += directions[i].distance
        }
        return max(0, cumDist - distAlongRoute)
    }
}
