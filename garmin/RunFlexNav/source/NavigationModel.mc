/**
 * NavigationModel — Core navigation state for the watch app.
 *
 * Tracks current position (from the watch GPS), matches it against
 * the loaded course, and computes:
 *   - Progress percentage along the route
 *   - Distance/instruction for the next turn
 *   - Whether the runner is off-route
 */

using Toybox.Position;
using Toybox.Math;
using Toybox.System;

class NavigationModel {
    // Course data (received from phone)
    var courseName = "";
    var courseLoaded = false;
    var waypoints = null;        // Array of {lat, lng} dicts
    var turnPoints = null;       // Array of turn point dicts
    var totalDistanceKm = 0.0;

    // Live navigation state
    var currentLat = 0.0;
    var currentLng = 0.0;
    var hasPosition = false;
    var progressFraction = 0.0;  // 0.0 – 1.0
    var distanceToNextTurnKm = null;
    var currentInstruction = "";
    var nextInstruction = null;
    var isOffRoute = false;
    var offRouteDistanceM = 0;
    var nearestRouteIdx = 0;

    // Thresholds (metres)
    const OFF_ROUTE_THRESHOLD_M = 100;
    const TURN_ALERT_M = 100;

    function initialize() {
    }

    /**
     * Load a course received from the phone.
     */
    function setCourse(data) {
        courseName = data.get("name");
        waypoints = data.get("waypoints");
        turnPoints = data.get("turnPoints");
        var td = data.get("totalDistance");
        totalDistanceKm = (td != null) ? td.toFloat() : 0.0;
        courseLoaded = true;
    }

    /**
     * Called when the watch receives a GPS position fix.
     * Updates all navigation state.
     */
    function onPositionUpdate(lat, lng) {
        currentLat = lat;
        currentLng = lng;
        hasPosition = true;

        if (!courseLoaded || waypoints == null || waypoints.size() < 2) {
            return;
        }

        // Find nearest point on route
        var nearest = findNearestRoutePoint(lat, lng);
        nearestRouteIdx = nearest[:index];
        var distFromRouteM = nearest[:distanceM];

        isOffRoute = (distFromRouteM > OFF_ROUTE_THRESHOLD_M);
        offRouteDistanceM = distFromRouteM.toNumber();

        // Calculate distance along route to nearest point
        var distAlongKm = cumulativeDistanceKm(nearestRouteIdx);

        // Progress
        if (totalDistanceKm > 0) {
            progressFraction = distAlongKm / totalDistanceKm;
            if (progressFraction > 1.0) {
                progressFraction = 1.0;
            }
        }

        // Find next turn
        updateNextTurn(distAlongKm);

        // Send progress update back to phone
        sendProgressToPhone();
    }

    /**
     * Accept a navigation state update pushed from the phone.
     */
    function updateFromPhone(payload) {
        var prog = payload.get("progress");
        if (prog != null) {
            progressFraction = prog.toFloat();
        }
        var inst = payload.get("currentInstruction");
        if (inst != null) {
            currentInstruction = inst;
        }
        var dtt = payload.get("distanceToNextTurn");
        if (dtt != null) {
            distanceToNextTurnKm = dtt.toFloat();
        }
        var ni = payload.get("nextInstruction");
        if (ni != null) {
            nextInstruction = ni;
        }
        var offR = payload.get("isOffRoute");
        if (offR != null) {
            isOffRoute = offR;
        }
    }

    // --- Private helpers ---

    hidden function findNearestRoutePoint(lat, lng) {
        var minDist = 999999999.0;
        var minIdx = 0;

        for (var i = 0; i < waypoints.size(); i++) {
            var wp = waypoints[i];
            var d = haversineM(lat, lng, wp.get("lat").toFloat(), wp.get("lng").toFloat());
            if (d < minDist) {
                minDist = d;
                minIdx = i;
            }
        }

        return { :index => minIdx, :distanceM => minDist };
    }

    hidden function cumulativeDistanceKm(upToIndex) {
        var dist = 0.0;
        for (var i = 1; i <= upToIndex && i < waypoints.size(); i++) {
            var p1 = waypoints[i - 1];
            var p2 = waypoints[i];
            dist += haversineM(
                p1.get("lat").toFloat(), p1.get("lng").toFloat(),
                p2.get("lat").toFloat(), p2.get("lng").toFloat()
            );
        }
        return dist / 1000.0;
    }

    hidden function updateNextTurn(distAlongKm) {
        if (turnPoints == null || turnPoints.size() == 0) {
            currentInstruction = "Follow route";
            distanceToNextTurnKm = null;
            nextInstruction = null;
            return;
        }

        // Find the next turn point ahead of current position
        for (var i = 0; i < turnPoints.size(); i++) {
            var tp = turnPoints[i];
            var tpDist = tp.get("distanceFromStart");
            if (tpDist != null && tpDist.toFloat() > distAlongKm) {
                currentInstruction = tp.get("instruction");
                distanceToNextTurnKm = tpDist.toFloat() - distAlongKm;

                // Look ahead for the instruction after this
                if (i + 1 < turnPoints.size()) {
                    nextInstruction = turnPoints[i + 1].get("instruction");
                } else {
                    nextInstruction = "Arrive at finish";
                }
                return;
            }
        }

        // Past all turns — approaching finish
        currentInstruction = "Approaching finish";
        distanceToNextTurnKm = totalDistanceKm - distAlongKm;
        nextInstruction = null;
    }

    hidden function sendProgressToPhone() {
        var msg = {
            "type" => "PROGRESS_UPDATE",
            "payload" => {
                "progress" => progressFraction,
                "position" => { "lat" => currentLat, "lng" => currentLng }
            },
            "timestamp" => System.getTimer()
        };

        Communications.transmit(msg, null, new CommListener());
    }

    /**
     * Haversine distance in metres between two lat/lng points.
     */
    hidden function haversineM(lat1, lng1, lat2, lng2) {
        var R = 6371000.0; // Earth radius in metres
        var dLat = Math.toRadians(lat2 - lat1);
        var dLng = Math.toRadians(lng2 - lng1);
        var a = Math.sin(dLat / 2.0) * Math.sin(dLat / 2.0) +
                Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                Math.sin(dLng / 2.0) * Math.sin(dLng / 2.0);
        var c = 2.0 * Math.atan2(Math.sqrt(a), Math.sqrt(1.0 - a));
        return R * c;
    }
}
