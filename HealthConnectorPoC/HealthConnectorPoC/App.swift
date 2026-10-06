import SwiftUI

@main
struct HealthConnectorPoCApp: App {
    @StateObject private var health = HealthService.shared
    @State private var link: AuraLinkRequest?

    var body: some Scene {
        WindowGroup {
            TabView {
                NavigationStack { OverviewView() }
                    .tabItem { Label("Overview", systemImage: "list.bullet") }
                NavigationStack { SleepNightsView() }
                    .tabItem { Label("Sleep", systemImage: "bed.double") }
                NavigationStack { UpdateLogView() }
                    .tabItem { Label("Updates", systemImage: "arrow.triangle.2.circlepath") }
            }
            .environmentObject(health)
            // Opened from the Aura web app ("Link with the Aura iOS app" / QR code).
            .onOpenURL { url in link = AuraLinkRequest(url: url) }
            .sheet(item: $link) { LinkView(link: $0).environmentObject(health) }
        }
    }
}
