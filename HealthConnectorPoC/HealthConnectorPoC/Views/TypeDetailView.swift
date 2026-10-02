import SwiftUI
import HealthKit

struct TypeDetailView: View {
    @EnvironmentObject var health: HealthService
    let entry: CatalogEntry
    @State private var records: [SignalRecord] = []

    var body: some View {
        List {
            Section("Sources") {
                let s = health.summaries[entry.id]?.sources ?? [:]
                if s.isEmpty { Text("none") }
                ForEach(s.sorted { $0.value > $1.value }, id: \.key) { Text("\($0.key): \($0.value)") }
            }
            Section("Newest records") {
                ForEach(records) { r in
                    NavigationLink(destination: RecordDetailView(record: r)) {
                        VStack(alignment: .leading) {
                            Text(r.categoryLabel ?? r.value.map { String(format: "%.2f", $0) + " " + (r.unit ?? "") } ?? "–")
                            Text("\(r.start.formatted()) · \(r.sourceName)").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .navigationTitle(entry.title)
        .task {
            let s = await health.samples(for: entry, days: health.days, limit: 50)
            records = s.map { SignalRecord(sample: $0, entry: entry) }
        }
    }
}
