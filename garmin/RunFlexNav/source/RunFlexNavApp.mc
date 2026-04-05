/**
 * RunFlexNavApp — Main Connect IQ Application
 *
 * Entry point for the RunFlex Navigation watch app. Manages the app
 * lifecycle and hands off to the NavigationView for rendering.
 */

using Toybox.Application;
using Toybox.WatchUi;
using Toybox.Communications;
using Toybox.System;

class RunFlexNavApp extends Application.AppBase {
    var courseData = null;       // Parsed course from phone
    var navigationModel = null; // Navigation state model

    function initialize() {
        AppBase.initialize();
    }

    function onStart(state) {
        // Register for phone communication messages
        Communications.registerForPhoneAppMessages(method(:onPhoneMessage));

        navigationModel = new NavigationModel();
    }

    function onStop(state) {
        // Clean up
    }

    function getInitialView() {
        var view = new NavigationView(navigationModel);
        var delegate = new NavigationDelegate(view, navigationModel);
        return [view, delegate];
    }

    /**
     * Handle incoming messages from the RunFlex phone app.
     * Messages arrive as JSON dictionaries over the Connect IQ BLE channel.
     */
    function onPhoneMessage(msg) {
        if (msg == null) {
            return;
        }

        var data = msg.data;
        if (data == null) {
            return;
        }

        var msgType = data.get("type");

        if (msgType != null && msgType.equals("COURSE_TRANSFER")) {
            handleCourseTransfer(data.get("payload"));
        } else if (msgType != null && msgType.equals("NAV_UPDATE")) {
            handleNavUpdate(data.get("payload"));
        }
    }

    /**
     * Process a course transfer from the phone.
     * Stores the route waypoints and turn points for on-watch navigation.
     */
    function handleCourseTransfer(payload) {
        if (payload == null) {
            return;
        }

        courseData = {
            "name" => payload.get("name"),
            "distance" => payload.get("distance"),
            "waypoints" => payload.get("waypoints"),
            "turnPoints" => payload.get("turnPoints"),
            "totalDistance" => payload.get("totalDistance")
        };

        if (navigationModel != null) {
            navigationModel.setCourse(courseData);
        }

        // Acknowledge receipt
        var ack = { "type" => "COURSE_ACK", "timestamp" => System.getTimer() };
        Communications.transmit(ack, null, new CommListener());

        WatchUi.requestUpdate();
    }

    /**
     * Handle a navigation state update from the phone.
     */
    function handleNavUpdate(payload) {
        if (payload == null || navigationModel == null) {
            return;
        }

        navigationModel.updateFromPhone(payload);
        WatchUi.requestUpdate();
    }
}

/**
 * Simple communication listener for transmit callbacks.
 */
class CommListener extends Communications.ConnectionListener {
    function initialize() {
        ConnectionListener.initialize();
    }

    function onComplete() {
        // Message sent successfully
    }

    function onError() {
        System.println("CommListener: transmit error");
    }
}
