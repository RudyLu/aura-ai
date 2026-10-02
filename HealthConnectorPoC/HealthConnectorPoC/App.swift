import SwiftUI

@main
struct HealthConnectorPoCApp: App {
    @StateObject private var health = HealthService.shared

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
        }
    }
}
