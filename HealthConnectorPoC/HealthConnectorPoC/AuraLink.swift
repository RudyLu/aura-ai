import HealthKit
import UIKit

/// A link from the Aura web app: `aura://link?t=<token>&h=<origin>[&r=1]` or the universal link
/// `https://<host>/link/<token>`. The token lets this app send daily totals once to that web session.
struct AuraLinkRequest: Identifiable, Equatable {
    let token: String
    let origin: URL
    let returnToBrowser: Bool   // started in Safari on this iPhone
    var id: String { token }

    init?(url: URL) {
        let c = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let q = { (n: String) in c?.queryItems?.first { $0.name == n }?.value }
        if url.scheme == "aura", url.host == "link", let t = q("t"), let h = q("h").flatMap(URL.init(string:)) {
            token = t; origin = h; returnToBrowser = q("r") == "1"
        } else if url.scheme == "https", url.pathComponents.count == 3, url.pathComponents[1] == "link",
                  let o = URL(string: "https://\(url.host ?? "")\(url.port.map { ":\($0)" } ?? "")") {
            token = url.pathComponents[2]; origin = o; returnToBrowser = false
        } else { return nil }
        guard token.range(of: "^[A-Za-z0-9_-]{22}$", options: .regularExpression) != nil,
              AuraLinkRequest.allowed(origin) else { return nil }
    }

    /// Health data only goes over HTTPS, except to a dev server on this machine or network.
    static func allowed(_ u: URL) -> Bool {
        if u.scheme == "https" { return true }
        guard u.scheme == "http", let h = u.host else { return false }
        return h == "localhost" || h == "127.0.0.1" || h.hasSuffix(".local")
    }
}

enum AuraLink {
    static let days = 60

    enum Kind: String, CaseIterable, Identifiable {
        case sleep, activity, cycle, hrv
        var id: String { rawValue }
        var title: String { ["sleep": "Sleep", "activity": "Exercise minutes", "cycle": "Period dates", "hrv": "Heart rate variability"][rawValue]! }
        var detail: String { ["sleep": "Hours asleep each night", "activity": "Daily total", "cycle": "Dates only", "hrv": "Read-only SDNN, workouts and mindful sessions"][rawValue]! }
        var hkType: HKSampleType {
            switch self {
            case .sleep: HKCategoryType(.sleepAnalysis)
            case .activity: HKQuantityType(.appleExerciseTime)
            case .cycle: HKCategoryType(.menstrualFlow)
            case .hrv: HKQuantityType(.heartRateVariabilitySDNN)
            }
        }
    }

    /// Exactly what is sent: daily totals keyed by local date (same shape as the web's HealthImport).
    struct HRVSample: Encodable { let t: String; let ms: Double; let timestamp: String }
    struct Interval: Encodable { let start: String; let end: String; let startAt: String; let endAt: String }
    struct Payload: Encodable {
        var sleep: [String: Double] = [:]
        var activity: [String: Double] = [:]
        var cycle: [String] = []
        var hrvSamples: [String: [HRVSample]]? = nil
        var workouts: [String: [Interval]]? = nil
        var mindful: [String: [Interval]]? = nil
        var timezone: String = TimeZone.current.identifier
        var range: [String]
        var granted: [String]
        var device: String
    }
    struct Result: Decodable { let ok: Bool?; let nights: Int?; let activeDays: Int?; let periodDates: Int?; let error: String? }

    static func dayKey(_ d: Date) -> String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian); f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = .current; f.dateFormat = "yyyy-MM-dd"
        return f.string(from: d)
    }

    @MainActor
    static func collect(_ kinds: Set<Kind>, health: HealthService) async throws -> Payload {
        var readTypes: Set<HKObjectType> = Set(kinds.map { $0.hkType as HKObjectType })
        if kinds.contains(.hrv) { readTypes.insert(HKObjectType.workoutType()); readTypes.insert(HKCategoryType(.mindfulSession)) }
        try await health.store.requestAuthorization(toShare: [], read: readTypes)
        let today = Date()
        let from = Calendar.current.date(byAdding: .day, value: -(days - 1), to: today)!
        var p = Payload(range: [dayKey(from), dayKey(today)], granted: kinds.map(\.rawValue).sorted(), device: UIDevice.current.model)
        func entry(_ k: Kind) -> CatalogEntry { HealthTypeCatalog.entries.first { $0.id == k.hkType.identifier }! }

        if kinds.contains(.sleep) {
            let s = await health.samples(for: entry(.sleep), days: days + 1).compactMap { $0 as? HKCategorySample }
            for n in SleepNights.build(from: s) where n.wakeDay >= Calendar.current.startOfDay(for: from) {
                p.sleep[dayKey(n.wakeDay)] = (n.asleepHours * 10).rounded() / 10
            }
        }
        if kinds.contains(.activity) {
            for case let q as HKQuantitySample in await health.samples(for: entry(.activity), days: days) {
                p.activity[dayKey(q.startDate), default: 0] += q.quantity.doubleValue(for: .minute())
            }
            p.activity = p.activity.mapValues { $0.rounded() }
        }
        if kinds.contains(.cycle) {
            let none = HKCategoryValueMenstrualFlow.none.rawValue
            let dates = await health.samples(for: entry(.cycle), days: days)
                .compactMap { $0 as? HKCategorySample }.filter { $0.value != none }.map { dayKey($0.startDate) }
            p.cycle = Array(Set(dates)).sorted()
        }
        if kinds.contains(.hrv) {
            let formatter = DateFormatter(); formatter.dateFormat = "HH:mm"; formatter.timeZone = .current
            let timestamp = ISO8601DateFormatter()
            p.hrvSamples = [:]; p.workouts = [:]; p.mindful = [:]
            for case let q as HKQuantitySample in await health.samples(for: entry(.hrv), days: days) {
                let ms = q.quantity.doubleValue(for: .secondUnit(with: .milli))
                if ms.isFinite && ms > 0 { p.hrvSamples![dayKey(q.startDate), default: []].append(HRVSample(t: formatter.string(from: q.startDate), ms: ms, timestamp: timestamp.string(from: q.startDate))) }
            }
            func readIntervals(_ type: HKSampleType) async throws -> [String: [Interval]] {
                let samples: [HKSample] = try await withCheckedThrowingContinuation { continuation in
                    let predicate = HKQuery.predicateForSamples(withStart: from, end: today)
                    let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, error in
                        if let error { continuation.resume(throwing: error) } else { continuation.resume(returning: samples ?? []) }
                    }
                    health.store.execute(query)
                }
                var output: [String: [Interval]] = [:]
                for sample in samples {
                    let startDay = dayKey(sample.startDate), endDay = dayKey(sample.endDate)
                    guard sample.endDate > sample.startDate else { continue }
                    var date = Calendar.current.startOfDay(for: sample.startDate)
                    let last = Calendar.current.startOfDay(for: sample.endDate)
                    while date <= last {
                        let day = dayKey(date)
                        let a = day == startDay ? formatter.string(from: sample.startDate) : "00:00"
                        let b = day == endDay ? formatter.string(from: sample.endDate) : "24:00"
                        if a != b || day == startDay {
                            output[day, default: []].append(Interval(start: a, end: b, startAt: timestamp.string(from: sample.startDate), endAt: timestamp.string(from: sample.endDate)))
                        }
                        date = Calendar.current.date(byAdding: .day, value: 1, to: date)!
                    }
                }
                return output
            }
            p.workouts = try await readIntervals(HKObjectType.workoutType())
            p.mindful = try await readIntervals(HKCategoryType(.mindfulSession))
        }
        return p
    }

    static func send(_ p: Payload, to link: AuraLinkRequest) async throws -> Result {
        var req = URLRequest(url: link.origin.appending(path: "api/health/sync"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(link.token)", forHTTPHeaderField: "Authorization")
        req.httpBody = try JSONEncoder().encode(p)
        let (data, res) = try await URLSession.shared.data(for: req)
        let r = (try? JSONDecoder().decode(Result.self, from: data)) ?? Result(ok: nil, nights: nil, activeDays: nil, periodDates: nil, error: nil)
        guard (res as? HTTPURLResponse)?.statusCode == 200, r.ok == true else {
            throw NSError(domain: "AuraLink", code: 1, userInfo: [NSLocalizedDescriptionKey: r.error ?? "Aura didn’t accept the data (\((res as? HTTPURLResponse)?.statusCode ?? 0))."])
        }
        return r
    }
}
