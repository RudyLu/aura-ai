import SwiftUI

struct OverviewView: View {
    @EnvironmentObject var health: HealthService

    var body: some View {
        List {
            Section {
                Button("Request Authorization") { Task { await health.requestAuthorization() } }
                Picker("Window", selection: $health.days) {
                    Text("7d").tag(7); Text("30d").tag(30); Text("90d").tag(90)
                }.pickerStyle(.segmented)
                .onChange(of: health.days) { _, _ in Task { await health.refreshAll() } }
                Button("Refresh") { Task { await health.refreshAll() } }
                Button("Copy summary") { UIPasteboard.general.string = health.summaryText() }
                #if targetEnvironment(simulator)
                Button("Seed synthetic data (simulator)") {
                    Task { health.status = await DebugSeeder.seed(store: health.store); await health.refreshAll() }
                }
                #endif
                if !health.status.isEmpty { Text(health.status).font(.footnote) }
                Text("HealthKit never reveals read-denial: 0 records = denied OR no data.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
            ForEach(HealthTypeCatalog.groups, id: \.self) { g in
                Section(g) {
                    ForEach(HealthTypeCatalog.entries.filter { $0.group == g }) { e in
                        NavigationLink(value: e.id) {
                            let s = health.summaries[e.id] ?? TypeSummary()
                            VStack(alignment: .leading) {
                                HStack { Text(e.title); Spacer(); Text("\(s.count)").monospacedDigit() }
                                Text("\(s.earliest?.formatted(date: .abbreviated, time: .omitted) ?? "–") → \(s.latest?.formatted(date: .abbreviated, time: .omitted) ?? "–") · \(s.sources.count) source(s)")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Health PoC")
        .navigationDestination(for: String.self) { id in
            if let e = HealthTypeCatalog.entries.first(where: { $0.id == id }) { TypeDetailView(entry: e) }
        }
    }
}
