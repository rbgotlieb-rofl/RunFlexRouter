import SwiftUI

/// Secondary screen (swipe/crown): shows detailed run metrics.
struct MetricsView: View {
    @ObservedObject var workoutManager: WorkoutManager
    @ObservedObject var navigationManager: NavigationManager
    let route: WatchRoute

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                // Progress ring
                progressRing

                // Core metrics grid
                LazyVGrid(columns: [
                    GridItem(.flexible()),
                    GridItem(.flexible())
                ], spacing: 10) {
                    metricCard(
                        label: "Pace",
                        value: workoutManager.metrics.formattedPace,
                        unit: "min/km",
                        icon: "gauge.medium",
                        color: .purple
                    )

                    metricCard(
                        label: "Distance",
                        value: workoutManager.metrics.formattedDistance,
                        unit: "km",
                        icon: "figure.run",
                        color: .green
                    )

                    metricCard(
                        label: "Time",
                        value: workoutManager.metrics.formattedTime,
                        unit: "elapsed",
                        icon: "clock",
                        color: .blue
                    )

                    if let hr = workoutManager.metrics.heartRate {
                        metricCard(
                            label: "Heart Rate",
                            value: String(format: "%.0f", hr),
                            unit: "bpm",
                            icon: "heart.fill",
                            color: .red
                        )
                    } else {
                        metricCard(
                            label: "Remaining",
                            value: remainingDistance,
                            unit: "km",
                            icon: "flag",
                            color: .orange
                        )
                    }
                }

                // Workout controls
                workoutControls
            }
            .padding(.horizontal, 2)
        }
    }

    // MARK: - Progress ring

    private var progressRing: some View {
        ZStack {
            Circle()
                .stroke(Color.gray.opacity(0.3), lineWidth: 6)
            Circle()
                .trim(from: 0, to: navigationManager.state.progress)
                .stroke(Color.green, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.easeInOut(duration: 0.5), value: navigationManager.state.progress)

            VStack(spacing: 0) {
                Text("\(Int(navigationManager.state.progress * 100))%")
                    .font(.system(.title3, design: .rounded).weight(.bold))
                Text("complete")
                    .font(.system(.caption2))
                    .foregroundColor(.secondary)
            }
        }
        .frame(width: 80, height: 80)
    }

    // MARK: - Metric card

    private func metricCard(label: String, value: String, unit: String, icon: String, color: Color) -> some View {
        VStack(spacing: 2) {
            Image(systemName: icon)
                .font(.system(size: 12))
                .foregroundColor(color)
            Text(value)
                .font(.system(.body, design: .rounded).weight(.bold))
                .minimumScaleFactor(0.7)
            Text(unit)
                .font(.system(size: 9))
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(Color.gray.opacity(0.15))
        .cornerRadius(10)
    }

    // MARK: - Controls

    private var workoutControls: some View {
        HStack(spacing: 12) {
            switch workoutManager.workoutState {
            case .running:
                Button(action: { workoutManager.pauseWorkout() }) {
                    Image(systemName: "pause.fill")
                        .font(.title3)
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .tint(.yellow)

                Button(action: { workoutManager.endWorkout() }) {
                    Image(systemName: "stop.fill")
                        .font(.title3)
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .tint(.red)

            case .paused:
                Button(action: { workoutManager.resumeWorkout() }) {
                    Image(systemName: "play.fill")
                        .font(.title3)
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(.green)

                Button(action: { workoutManager.endWorkout() }) {
                    Image(systemName: "stop.fill")
                        .font(.title3)
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .tint(.red)

            default:
                EmptyView()
            }
        }
        .padding(.top, 4)
    }

    private var remainingDistance: String {
        let remaining = max(0, route.distance - workoutManager.metrics.distanceKm)
        return String(format: "%.1f", remaining)
    }
}
