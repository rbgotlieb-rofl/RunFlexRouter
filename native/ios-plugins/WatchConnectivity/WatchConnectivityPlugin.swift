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

        // Build a clean dictionary that can be serialized to JSON and decoded
        // by WatchRoute on the watch side
        var routeDict: [String: Any] = [:]
        routeDict["id"] = routeData["id"] as? Int ?? 0
        routeDict["name"] = routeData["name"] as? String ?? "Route"
        routeDict["distance"] = routeData["distance"] as? Double ?? 0
        routeDict["estimatedTime"] = routeData["estimatedTime"] as? Double
        routeDict["syncedAt"] = Date().timeIntervalSince1970

        // Convert routePath — Capacitor sends as JSArray (array of JSObject)
        if let pathArray = routeData["routePath"] as? JSArray {
            var coords: [[String: Double]] = []
            for item in pathArray {
                if let point = item as? JSObject,
                   let lat = point["lat"] as? Double,
                   let lng = point["lng"] as? Double {
                    coords.append(["lat": lat, "lng": lng])
                }
            }
            routeDict["routePath"] = coords
        }

        // Convert directions
        if let dirsArray = routeData["directions"] as? JSArray {
            var steps: [[String: Any]] = []
            for item in dirsArray {
                if let step = item as? JSObject {
                    var stepDict: [String: Any] = [:]
                    stepDict["instruction"] = step["instruction"] as? String ?? ""
                    stepDict["distance"] = step["distance"] as? Double ?? 0
                    stepDict["duration"] = step["duration"] as? Double ?? 0
                    steps.append(stepDict)
                }
            }
            routeDict["directions"] = steps
        }

        manager.sendRoute(routeDict)
        call.resolve(["success": true])
    }
}
