import SwiftUI

struct UpdateLogView: View {
    @EnvironmentObject var health: HealthService
    var body: some View {
        List(health.updates.reversed()) { u in
            VStack(alignment: .leading) {
                Text(u.type).bold()
                Text("\(u.date.formatted(date: .abbreviated, time: .standard)) · +\(u.added) / −\(u.deleted) · \(u.inBackground ? "background" : "foreground")")
                    .font(.caption).foregroundStyle(.secondary)
            }
        }
        .overlay { if health.updates.isEmpty { Text("No updates yet. Add data in Health with this app running or backgrounded.").multilineTextAlignment(.center).padding().foregroundStyle(.secondary) } }
        .navigationTitle("Update log")
        .toolbar { Button("Clear") { health.clearUpdates() } }
    }
}
