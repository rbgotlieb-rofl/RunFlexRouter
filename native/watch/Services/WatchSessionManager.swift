import WatchConnectivity
import Combine

/// Watch-side WCSession manager: receives routes from the iPhone app.
final class WatchSessionManager: NSObject, ObservableObject, WCSessionDelegate {
    static let shared = WatchSessionManager()

    @Published var receivedRoute: WatchRoute?
    @Published var isReachable: Bool = false

    private override init() {
        super.init()
    }

    func activate() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    /// Send live tracking data back to iPhone (distance, pace, location).
    func sendLiveUpdate(metrics: RunMetrics, lat: Double, lng: Double) {
        guard WCSession.default.isReachable else { return }
        let message: [String: Any] = [
            "type": "liveUpdate",
            "distanceKm": metrics.distanceKm,
            "elapsedSeconds": metrics.elapsedSeconds,
            "paceMinPerKm": metrics.paceMinPerKm ?? 0,
            "lat": lat,
            "lng": lng
        ]
        WCSession.default.sendMessage(message, replyHandler: nil, errorHandler: nil)
    }

    /// Notify iPhone that the run has completed.
    func sendRunComplete(metrics: RunMetrics) {
        let data: [String: Any] = [
            "type": "runComplete",
            "distanceKm": metrics.distanceKm,
            "elapsedSeconds": metrics.elapsedSeconds,
            "paceMinPerKm": metrics.paceMinPerKm ?? 0
        ]
        // Use transferUserInfo so it's guaranteed to deliver even if not reachable
        WCSession.default.transferUserInfo(data)
    }

    // MARK: - WCSessionDelegate

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        DispatchQueue.main.async {
            self.isReachable = session.isReachable
        }
    }

    /// Receive route data sent via sendMessage (instant, when reachable).
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        handleIncoming(message)
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
        handleIncoming(message)
        replyHandler(["status": "received"])
    }

    /// Receive route data sent via transferUserInfo (queued, guaranteed delivery).
    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        handleIncoming(userInfo)
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async {
            self.isReachable = session.isReachable
        }
    }

    // MARK: - Parse incoming route

    private func handleIncoming(_ data: [String: Any]) {
        guard let type = data["type"] as? String, type == "routeSync" else { return }
        guard let jsonData = try? JSONSerialization.data(withJSONObject: data["route"] ?? [:]) else { return }

        do {
            let route = try JSONDecoder().decode(WatchRoute.self, from: jsonData)
            DispatchQueue.main.async {
                self.receivedRoute = route
            }
        } catch {
            print("[WatchSessionManager] Failed to decode route: \(error)")
        }
    }
}
