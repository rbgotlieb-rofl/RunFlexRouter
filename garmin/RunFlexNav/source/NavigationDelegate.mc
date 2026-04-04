/**
 * NavigationDelegate — Input handler for the navigation view.
 *
 * Handles physical button presses and touch events on the watch.
 * - SELECT/TAP: toggle between map-centred and overview mode
 * - BACK: exit the app (with confirmation if course is active)
 */

using Toybox.WatchUi;
using Toybox.System;

class NavigationDelegate extends WatchUi.BehaviorDelegate {
    var view;
    var model;

    function initialize(navView, navModel) {
        BehaviorDelegate.initialize();
        view = navView;
        model = navModel;
    }

    function onSelect() {
        // Toggle map view mode (could zoom in/out in future)
        WatchUi.requestUpdate();
        return true;
    }

    function onBack() {
        if (model.courseLoaded && model.progressFraction < 0.95) {
            // Confirm exit if run is in progress
            var dialog = new WatchUi.Confirmation("End navigation?");
            WatchUi.pushView(dialog, new ExitConfirmDelegate(), WatchUi.SLIDE_UP);
            return true;
        }

        // Send disconnect message to phone
        var msg = {
            "type" => "DISCONNECT",
            "timestamp" => System.getTimer()
        };
        Communications.transmit(msg, null, new CommListener());

        WatchUi.popView(WatchUi.SLIDE_DOWN);
        return true;
    }
}

/**
 * Confirmation dialog delegate for exiting during an active run.
 */
class ExitConfirmDelegate extends WatchUi.ConfirmationDelegate {
    function initialize() {
        ConfirmationDelegate.initialize();
    }

    function onResponse(response) {
        if (response == WatchUi.CONFIRM_YES) {
            var msg = {
                "type" => "DISCONNECT",
                "timestamp" => System.getTimer()
            };
            Communications.transmit(msg, null, new CommListener());
            WatchUi.popView(WatchUi.SLIDE_DOWN);
        }
        return true;
    }
}
