import SwiftUI

/// Shown after the workout ends with a run summary.
struct RunCompleteView: View {
    let metrics: RunMetrics
    let route: WatchRoute
    let onDismiss: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                // Header
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 36))
                    .foregroundColor(.green)

                Text("Run Complete!")
                    .font(.system(.headline, design: .rounded))

                Text(route.name)
                    .font(.system(.caption, design: .rounded))
                    .foregroundColor(.secondary)
                    .lineLimit(1)

                // Summary stats
                VStack(spacing: 8) {
                    summaryRow(icon: "figure.run", label: "Distance", value: "\(metrics.formattedDistance) km", color: .green)
                    summaryRow(icon: "clock", label: "Time", value: metrics.formattedTime, color: .blue)
                    summaryRow(icon: "gauge.medium", label: "Avg Pace", value: "\(metrics.formattedPace) /km", color: .purple)

                    if let cals = metrics.activeCalories {
                        summaryRow(icon: "flame.fill", label: "Calories", value: "\(Int(cals)) kcal", color: .orange)
                    }
                }
                .padding(.vertical, 4)

                // Done button
                Button(action: onDismiss) {
                    Text("Done")
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(.blue)
            }
            .padding(.horizontal, 4)
        }
    }

    private func summaryRow(icon: String, label: String, value: String, color: Color) -> some View {
        HStack {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundColor(color)
                .frame(width: 24)

            Text(label)
                .font(.system(.caption, design: .rounded))
                .foregroundColor(.secondary)

            Spacer()

            Text(value)
                .font(.system(.caption, design: .rounded).weight(.semibold))
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(Color.gray.opacity(0.12))
        .cornerRadius(8)
    }
}
