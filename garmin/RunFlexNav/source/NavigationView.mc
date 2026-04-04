/**
 * NavigationView — Main watch face for RunFlex Navigation.
 *
 * Renders:
 *   - A minimap with the route polyline and the runner's current position
 *   - Next turn instruction + distance
 *   - Progress bar showing % completion of the route
 *   - Off-route warning banner
 */

using Toybox.WatchUi;
using Toybox.Graphics;
using Toybox.Position;
using Toybox.System;
using Toybox.Timer;

class NavigationView extends WatchUi.View {
    var model;
    var positionTimer;

    // Colours
    const COLOR_ROUTE = 0x3B82F6;     // Blue route line
    const COLOR_PROGRESS = 0x22C55E;  // Green progress
    const COLOR_OFF_ROUTE = 0xEF4444; // Red warning
    const COLOR_BG = 0x000000;        // Black background
    const COLOR_TEXT = 0xFFFFFF;       // White text
    const COLOR_DIM = 0x9CA3AF;       // Gray secondary text
    const COLOR_POSITION = 0x60A5FA;  // Light blue position dot

    function initialize(navModel) {
        View.initialize();
        model = navModel;
    }

    function onLayout(dc) {
        // Start GPS position listening
        var options = {
            :acquisitionType => Position.LOCATION_CONTINUOUS,
            :constellations => [Position.CONSTELLATION_GPS, Position.CONSTELLATION_GLONASS]
        };
        Position.enableLocationEvents(options, method(:onPosition));
    }

    function onShow() {
    }

    function onHide() {
    }

    /**
     * GPS position callback — feed position into the navigation model.
     */
    function onPosition(info) {
        if (info == null || info.position == null) {
            return;
        }

        var pos = info.position.toDegrees();
        model.onPositionUpdate(pos[0], pos[1]);
        WatchUi.requestUpdate();
    }

    /**
     * Main render function. Draws the complete navigation UI.
     */
    function onUpdate(dc) {
        dc.setColor(COLOR_BG, COLOR_BG);
        dc.clear();

        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;
        var cy = h / 2;

        if (!model.courseLoaded) {
            drawWaitingScreen(dc, w, h, cx, cy);
            return;
        }

        // Layout zones (for round watch face):
        // Top 55%:  minimap
        // Middle:   turn instruction
        // Bottom:   progress bar + percentage
        var mapHeight = (h * 0.55).toNumber();
        var instructionY = mapHeight + 4;
        var progressY = h - 32;

        // 1) Draw minimap
        drawMinimap(dc, w, mapHeight, cx);

        // 2) Draw off-route warning or turn instruction
        if (model.isOffRoute) {
            drawOffRouteWarning(dc, w, instructionY);
        } else {
            drawTurnInstruction(dc, w, instructionY);
        }

        // 3) Draw progress bar
        drawProgressBar(dc, w, h, progressY);
    }

    // ---- Drawing helpers ----

    hidden function drawWaitingScreen(dc, w, h, cx, cy) {
        dc.setColor(COLOR_DIM, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy - 20, Graphics.FONT_SMALL, "RunFlex Nav", Graphics.TEXT_JUSTIFY_CENTER);
        dc.setColor(COLOR_TEXT, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, cy + 10, Graphics.FONT_TINY, "Waiting for course", Graphics.TEXT_JUSTIFY_CENTER);
        dc.drawText(cx, cy + 30, Graphics.FONT_TINY, "from phone...", Graphics.TEXT_JUSTIFY_CENTER);
    }

    /**
     * Draw a simplified map showing the route polyline and current position.
     * Projects lat/lng coordinates into screen space within the map viewport.
     */
    hidden function drawMinimap(dc, mapW, mapH, cx) {
        if (model.waypoints == null || model.waypoints.size() < 2) {
            return;
        }

        // Compute bounding box of all waypoints
        var minLat = 90.0;
        var maxLat = -90.0;
        var minLng = 180.0;
        var maxLng = -180.0;

        for (var i = 0; i < model.waypoints.size(); i++) {
            var wp = model.waypoints[i];
            var lat = wp.get("lat").toFloat();
            var lng = wp.get("lng").toFloat();
            if (lat < minLat) { minLat = lat; }
            if (lat > maxLat) { maxLat = lat; }
            if (lng < minLng) { minLng = lng; }
            if (lng > maxLng) { maxLng = lng; }
        }

        // Add padding
        var latPad = (maxLat - minLat) * 0.15;
        var lngPad = (maxLng - minLng) * 0.15;
        if (latPad < 0.0005) { latPad = 0.0005; }
        if (lngPad < 0.0005) { lngPad = 0.0005; }
        minLat -= latPad;
        maxLat += latPad;
        minLng -= lngPad;
        maxLng += lngPad;

        var latRange = maxLat - minLat;
        var lngRange = maxLng - minLng;
        if (latRange == 0) { latRange = 0.001; }
        if (lngRange == 0) { lngRange = 0.001; }

        // Margin from screen edges (for round displays)
        var margin = 12;
        var drawW = mapW - margin * 2;
        var drawH = mapH - margin * 2;

        // Draw route polyline
        dc.setColor(COLOR_ROUTE, Graphics.COLOR_TRANSPARENT);
        dc.setPenWidth(2);

        var prevX = 0;
        var prevY = 0;
        for (var i = 0; i < model.waypoints.size(); i++) {
            var wp = model.waypoints[i];
            var lat = wp.get("lat").toFloat();
            var lng = wp.get("lng").toFloat();

            var sx = margin + ((lng - minLng) / lngRange * drawW).toNumber();
            var sy = margin + ((maxLat - lat) / latRange * drawH).toNumber();

            if (i > 0) {
                dc.drawLine(prevX, prevY, sx, sy);
            }
            prevX = sx;
            prevY = sy;
        }

        // Draw upcoming turn points as small dots
        if (model.turnPoints != null) {
            dc.setColor(Graphics.COLOR_YELLOW, Graphics.COLOR_TRANSPARENT);
            for (var i = 0; i < model.turnPoints.size(); i++) {
                var tp = model.turnPoints[i];
                var pos = tp.get("position");
                if (pos != null) {
                    var lat = pos.get("lat").toFloat();
                    var lng = pos.get("lng").toFloat();
                    var tx = margin + ((lng - minLng) / lngRange * drawW).toNumber();
                    var ty = margin + ((maxLat - lat) / latRange * drawH).toNumber();
                    dc.fillCircle(tx, ty, 3);
                }
            }
        }

        // Draw current position
        if (model.hasPosition) {
            var px = margin + ((model.currentLng - minLng) / lngRange * drawW).toNumber();
            var py = margin + ((maxLat - model.currentLat) / latRange * drawH).toNumber();

            // Pulsing ring effect (outer)
            dc.setColor(COLOR_POSITION, Graphics.COLOR_TRANSPARENT);
            dc.drawCircle(px, py, 8);

            // Solid position dot
            dc.fillCircle(px, py, 5);

            // White centre
            dc.setColor(COLOR_TEXT, Graphics.COLOR_TRANSPARENT);
            dc.fillCircle(px, py, 2);
        }

        dc.setPenWidth(1);
    }

    /**
     * Draw the off-route warning banner.
     */
    hidden function drawOffRouteWarning(dc, w, y) {
        dc.setColor(COLOR_OFF_ROUTE, Graphics.COLOR_TRANSPARENT);
        dc.fillRectangle(0, y, w, 36);

        dc.setColor(COLOR_TEXT, Graphics.COLOR_TRANSPARENT);
        dc.drawText(w / 2, y + 4, Graphics.FONT_SMALL, "OFF ROUTE", Graphics.TEXT_JUSTIFY_CENTER);
        dc.setColor(COLOR_TEXT, Graphics.COLOR_TRANSPARENT);
        dc.drawText(w / 2, y + 22, Graphics.FONT_XTINY,
            model.offRouteDistanceM.toString() + "m from path",
            Graphics.TEXT_JUSTIFY_CENTER);
    }

    /**
     * Draw the next turn instruction and distance.
     */
    hidden function drawTurnInstruction(dc, w, y) {
        // Instruction text
        dc.setColor(COLOR_TEXT, Graphics.COLOR_TRANSPARENT);
        var instruction = model.currentInstruction;
        if (instruction == null || instruction.length() == 0) {
            instruction = "Follow route";
        }
        // Truncate long instructions
        if (instruction.length() > 25) {
            instruction = instruction.substring(0, 22) + "...";
        }
        dc.drawText(w / 2, y, Graphics.FONT_TINY, instruction, Graphics.TEXT_JUSTIFY_CENTER);

        // Distance to next turn
        if (model.distanceToNextTurnKm != null) {
            dc.setColor(COLOR_DIM, Graphics.COLOR_TRANSPARENT);
            var distStr;
            if (model.distanceToNextTurnKm >= 1.0) {
                distStr = model.distanceToNextTurnKm.format("%.1f") + " km";
            } else {
                distStr = (model.distanceToNextTurnKm * 1000).toNumber().toString() + " m";
            }
            dc.drawText(w / 2, y + 18, Graphics.FONT_XTINY, distStr, Graphics.TEXT_JUSTIFY_CENTER);
        }

        // Next instruction preview
        if (model.nextInstruction != null) {
            dc.setColor(COLOR_DIM, Graphics.COLOR_TRANSPARENT);
            var next = model.nextInstruction;
            if (next.length() > 30) {
                next = next.substring(0, 27) + "...";
            }
            dc.drawText(w / 2, y + 34, Graphics.FONT_XTINY, "Then: " + next, Graphics.TEXT_JUSTIFY_CENTER);
        }
    }

    /**
     * Draw the progress bar and percentage text at the bottom.
     */
    hidden function drawProgressBar(dc, w, h, y) {
        var barMargin = 20;
        var barW = w - barMargin * 2;
        var barH = 6;

        // Background track
        dc.setColor(0x374151, Graphics.COLOR_TRANSPARENT); // gray-700
        dc.fillRoundedRectangle(barMargin, y, barW, barH, 3);

        // Filled progress
        var fillW = (barW * model.progressFraction).toNumber();
        if (fillW > 0) {
            dc.setColor(COLOR_PROGRESS, Graphics.COLOR_TRANSPARENT);
            dc.fillRoundedRectangle(barMargin, y, fillW, barH, 3);
        }

        // Percentage text
        var pctStr = (model.progressFraction * 100).toNumber().toString() + "%";
        dc.setColor(COLOR_TEXT, Graphics.COLOR_TRANSPARENT);
        dc.drawText(w / 2, y + barH + 2, Graphics.FONT_XTINY, pctStr, Graphics.TEXT_JUSTIFY_CENTER);
    }
}
