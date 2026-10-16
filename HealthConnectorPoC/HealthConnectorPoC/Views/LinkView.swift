import SwiftUI

/// Consent + send screen for a link opened from the Aura web app.
struct LinkView: View {
    let link: AuraLinkRequest
    @EnvironmentObject var health: HealthService
    @Environment(\.dismiss) private var dismiss
    @State private var kinds = Set(AuraLink.Kind.allCases)
    @State private var phase: Phase = .ready

    enum Phase { case ready, sending, sent(AuraLink.Result), failed(String) }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    LabeledContent("Send to", value: link.origin.host ?? link.origin.absoluteString)
                    Text("Aura will use these next to your check-ins in the browser session that showed this link.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
                Section {
                    ForEach(AuraLink.Kind.allCases) { k in
                        Toggle(isOn: Binding(get: { kinds.contains(k) }, set: { on in if on { kinds.insert(k) } else { kinds.remove(k) } })) {
                            VStack(alignment: .leading) { Text(k.title); Text(k.detail).font(.caption).foregroundStyle(.secondary) }
                        }
                    }
                } header: { Text("Choose data, last \(AuraLink.days) days") } footer: {
                    Text("Sleep, exercise and period dates are daily totals. If you select HRV, timestamped SDNN samples plus workout and mindful-session intervals are also sent read-only. This link works once; return to the browser to see your records.")
                }
                Section { content }
            }
            .navigationTitle("Link Apple Health")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } } }
        }
    }

    @ViewBuilder private var content: some View {
        switch phase {
        case .ready:
            Button("Allow & send to Aura") { Task { await send() } }.disabled(kinds.isEmpty)
        case .sending:
            HStack { ProgressView(); Text("Reading Apple Health and sending…") }
        case .sent(let r):
            Label("Sent \(r.nights ?? 0) nights · \(r.activeDays ?? 0) active days · \(r.periodDates ?? 0) period dates", systemImage: "checkmark.circle.fill")
                .foregroundStyle(.green)
            if link.returnToBrowser {
                // iOS shows a "‹ Safari" control at the top left when this app was opened from a Safari link.
                // Using it returns to the same tab; opening the URL here would start a new one.
                Text("Tap ‹ Safari at the top left of the screen to go back to Aura.").foregroundStyle(.secondary)
                Button("Done") { dismiss() }
                Button("Can’t see it? Open Aura in Safari") { UIApplication.shared.open(link.origin); dismiss() }
                    .font(.footnote)
            } else {
                Text("Your browser updates by itself.").foregroundStyle(.secondary)
                Button("Done") { dismiss() }
            }
        case .failed(let msg):
            Text(msg).foregroundStyle(.red)
            Button("Try again") { Task { await send() } }
        }
    }

    private func send() async {
        phase = .sending
        do {
            let p = try await AuraLink.collect(kinds, health: health)
            phase = .sent(try await AuraLink.send(p, to: link))
        } catch { phase = .failed(error.localizedDescription) }
    }
}
