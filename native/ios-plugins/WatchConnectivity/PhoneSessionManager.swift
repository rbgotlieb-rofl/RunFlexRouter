import WatchConnectivity
import Combine

/// iPhone-side WCSession manager: sends routes to Apple Watch,
/// receives live tracking updates during a run.
final class PhoneSessionManager: NSObject, ObservableObject, WCSessionDelegate {
    static let shared = PhoneSessionManager()

    @Published var isPaired: Bool = false
    @Published var isWatchAppInstalled: Bool = false
    @Published var isReachable: Bool = false
    @Published var lastSyncStatus: SyncStatus = .idle

    /// Live tracking data received from watch during a run.
    @Published var liveUpdate: LiveWatchUpdate?

    enum SyncStatus: Equatable {
        case idle
        case sending
        case sent
        case failed(String)
    }

    struct LiveWatchUpdate {
        let distanceKm: Double
        let elapsedSeconds: Double
        let paceMinPerKm: Double
        let lat: Double
        let lng: Double
        let timestamp: Date
    }

    private override init() {
        super.init()
    }

    func activate() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    /// Send a route to the Watch.
    func sendRoute(_ routeData: [String: Any]) {
        guard WCSession.default.activationState == .activated else {
            lastSyncStatus = .failed("Watch not connected")
            return
        }

        lastSyncStatus = .sending

        let message: [String: Any] = [
            "type": "routeSync",
            "route": routeData
        ]

        if WCSession.default.isReachable {
            // Instant delivery when watch is reachable
            WCSession.default.sendMessage(message, replyHandler: { [weak self] reply in
                DispatchQueue.main.async {
                    self?.lastSyncStatus = .sent
                }
            }, errorHandler: { [weak self] error in
                // Fallback to transferUserInfo
                WCSession.default.transferUserInfo(message)
                DispatchQueue.main.async {
                    self?.lastSyncStatus = .sent
                }
            })
        } else {
            // Queued delivery — will arrive when watch is next connected
            WCSession.default.transferUserInfo(message)
            DispatchQueue.main.async {
                self.lastSyncStatus = .sent
            }
        }
    }

    // MARK: - WCSessionDelegate

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        DispatchQueue.main.async {
            self.isPaired = session.isPaired
            self.isWatchAppInstalled = session.isWatchAppInstalled
            self.isReachable = session.isReachable
        }
    }

    func sessionDidBecomeInactive(_ session: WCSession) {}

    func sessionDidDeactivate(_ session: WCSession) {
        // Re-activate for session transfer
        session.activate()
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async {
            self.isReachable = session.isReachable
        }
    }

    func sessionWatchStateDidChange(_ session: WCSession) {
        DispatchQueue.main.async {
            self.isPaired = session.isPaired
            self.isWatchAppInstalled = session.isWatchAppInstalled
        }
    }

    /// Receive live tracking updates from the watch.
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        handleIncoming(message)
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        handleIncoming(userInfo)
    }

    private func handleIncoming(_ data: [String: Any]) {
        guard let type = data["type"] as? String else { return }

        switch type {
        case "liveUpdate":
            DispatchQueue.main.async {
                self.liveUpdate = LiveWatchUpdate(
                    distanceKm: data["distanceKm"] as? Double ?? 0,
                    elapsedSeconds: data["elapsedSeconds"] as? Double ?? 0,
                    paceMinPerKm: data["paceMinPerKm"] as? Double ?? 0,
                    lat: data["lat"] as? Double ?? 0,
                    lng: data["lng"] as? Double ?? 0,
                    timestamp: Date()
                )
            }
        case "runComplete":
            DispatchQueue.main.async {
                self.liveUpdate = LiveWatchUpdate(
                    distanceKm: data["distanceKm"] as? Double ?? 0,
                    elapsedSeconds: data["elapsedSeconds"] as? Double ?? 0,
                    paceMinPerKm: data["paceMinPerKm"] as? Double ?? 0,
                    lat: 0, lng: 0,
                    timestamp: Date()
                )
            }
        default:
            break
        }
    }
}
