import Capacitor
import WatchConnectivity

/// Capacitor plugin that bridges Watch Connectivity to the web app.
/// Allows the React app to send routes to Apple Watch and receive status updates.
@objc(WatchConnectivityPlugin)
public class WatchConnectivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WatchConnectivityPlugin"
    public let jsName = "WatchConnectivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isSupported", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getWatchStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sendRoute", returnType: CAPPluginReturnPromise),
    ]

    private var manager: PhoneSessionManager {
        PhoneSessionManager.shared
    }

    public override func load() {
        manager.activate()
    }

    /// Check if Watch Connectivity is available on this device.
    @objc func isSupported(_ call: CAPPluginCall) {
        call.resolve(["supported": WCSession.isSupported()])
    }

    /// Get the current watch connection status.
    @objc func getWatchStatus(_ call: CAPPluginCall) {
        call.resolve([
            "isPaired": manager.isPaired,
            "isWatchAppInstalled": manager.isWatchAppInstalled,
            "isReachable": manager.isReachable
        ])
    }

    /// Send a route to the watch.
    /// Expects: { route: { id, name, distance, estimatedTime, routePath, directions } }
    @objc func sendRoute(_ call: CAPPluginCall) {
        guard let routeData = call.getObject("route") else {
            call.reject("Missing route data")
            return
        }

        // Convert JSObject to [String: Any] for WCSession
        var routeDict: [String: Any] = [:]
        routeDict["id"] = routeData["id"]
        routeDict["name"] = routeData["name"]
        routeDict["distance"] = routeData["distance"]
        routeDict["estimatedTime"] = routeData["estimatedTime"]
        routeDict["syncedAt"] = ISO8601DateFormatter().string(from: Date())

        // Convert routePath
        if let pathArray = routeData["routePath"] as? [[String: Any]] {
            routeDict["routePath"] = pathArray
        }

        // Convert directions
        if let dirsArray = routeData["directions"] as? [[String: Any]] {
            routeDict["directions"] = dirsArray
        }

        manager.sendRoute(routeDict)
        call.resolve(["success": true])
    }
}
