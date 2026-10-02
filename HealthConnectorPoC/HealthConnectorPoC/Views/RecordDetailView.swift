import SwiftUI

struct RecordDetailView: View {
    let record: SignalRecord
    var body: some View {
        List {
            row("uuid", record.id.uuidString)
            row("type", record.type)
            row("value", record.value.map { "\($0)" } ?? "–")
            row("unit", record.unit ?? "–")
            row("category", record.categoryLabel ?? "–")
            row("start", record.start.formatted(date: .complete, time: .complete))
            row("end", record.end.formatted(date: .complete, time: .complete))
            row("timezone", record.timeZone)
            row("source", record.sourceName)
            row("bundle", record.sourceBundleId)
            row("version", record.sourceVersion ?? "–")
            row("device", record.device ?? "–")
            row("userEntered", "\(record.wasUserEntered)")
            row("fetchedAt", record.fetchedAt.formatted())
            Section("Metadata") {
                if record.metadata.isEmpty { Text("none") }
                ForEach(record.metadata.sorted { $0.key < $1.key }, id: \.key) { row($0.key, $0.value) }
            }
        }
        .navigationTitle("Record")
    }
    private func row(_ k: String, _ v: String) -> some View {
        VStack(alignment: .leading) { Text(k).font(.caption).foregroundStyle(.secondary); Text(v).textSelection(.enabled) }
    }
}
