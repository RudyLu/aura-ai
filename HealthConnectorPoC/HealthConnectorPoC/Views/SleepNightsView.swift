import SwiftUI
import HealthKit

struct SleepNightsView: View {
    @EnvironmentObject var health: HealthService
    @State private var nights: [SleepNight] = []

    var body: some View {
        List(nights) { n in
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(n.wakeDay.formatted(date: .abbreviated, time: .omitted)).bold()
                    Spacer()
                    Text(String(format: "%.1f h", n.asleepHours)).monospacedDigit()
                    if n.under7h { Text("<7h").foregroundStyle(.red) }
                }
                Text("\(n.bedtime.formatted(date: .omitted, time: .shortened)) → \(n.wake.formatted(date: .omitted, time: .shortened)) · \(n.source)")
                    .font(.caption)
                Text(n.stageMinutes.sorted { $0.key < $1.key }.map { "\($0.key) \(Int($0.value))m" }.joined(separator: ", "))
                    .font(.caption2).foregroundStyle(.secondary)
                if !n.otherSources.isEmpty {
                    Text("not counted: \(n.otherSources.joined(separator: ", "))").font(.caption2).foregroundStyle(.orange)
                }
            }
        }
        .overlay { if nights.isEmpty { Text("No sleep nights. Authorize on Overview first.").foregroundStyle(.secondary) } }
        .navigationTitle("Sleep nights")
        .toolbar { Button("Reload") { Task { await load() } } }
        .task { await load() }
    }

    private func load() async {
        guard let e = HealthTypeCatalog.entries.first(where: { $0.id == HKCategoryTypeIdentifier.sleepAnalysis.rawValue }) else { return }
        let s = await health.samples(for: e, days: health.days).compactMap { $0 as? HKCategorySample }
        nights = SleepNights.build(from: s)
    }
}
