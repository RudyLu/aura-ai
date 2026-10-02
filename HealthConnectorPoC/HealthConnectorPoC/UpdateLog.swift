import Foundation

struct UpdateEvent: Codable, Identifiable {
    var id = UUID()
    let date: Date
    let type: String
    let added: Int
    let deleted: Int
    let inBackground: Bool
}

enum UpdateLogStore {
    private static let key = "updateLog"
    static func load() -> [UpdateEvent] {
        guard let d = UserDefaults.standard.data(forKey: key),
              let v = try? JSONDecoder().decode([UpdateEvent].self, from: d) else { return [] }
        return v
    }
    static func save(_ v: [UpdateEvent]) {
        if let d = try? JSONEncoder().encode(Array(v.suffix(200))) { UserDefaults.standard.set(d, forKey: key) }
    }
}
