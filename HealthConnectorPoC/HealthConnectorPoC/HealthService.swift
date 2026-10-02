import HealthKit
import SwiftUI

struct TypeSummary {
    var count = 0
    var earliest: Date?
    var latest: Date?
    var sources: [String: Int] = [:]
}

@MainActor
final class HealthService: ObservableObject {
    static let shared = HealthService()
    let store = HKHealthStore()

    @Published var authRequested = false
    @Published var days = 30
    @Published var summaries: [String: TypeSummary] = [:]
    @Published var updates: [UpdateEvent] = UpdateLogStore.load()
    @Published var status = ""

    var available: Bool { HKHealthStore.isHealthDataAvailable() }

    func requestAuthorization() async {
        guard available else { status = "Health data unavailable on this device"; return }
        do {
            var share = Set<HKSampleType>()
            #if targetEnvironment(simulator)
            let unshareable: Set<String> = [HKQuantityTypeIdentifier.appleSleepingWristTemperature.rawValue,
                                            HKQuantityTypeIdentifier.appleExerciseTime.rawValue]
            share = Set(HealthTypeCatalog.entries
                .filter { $0.kind != .workout && $0.kind != .stateOfMind && !unshareable.contains($0.id) }
                .map { $0.sampleType })
            #endif
            try await store.requestAuthorization(toShare: share, read: HealthTypeCatalog.readTypes)
            authRequested = true
            await refreshAll()
            startObservers()
        } catch { status = "Auth error: \(error.localizedDescription)" }
    }

    func samples(for entry: CatalogEntry, days: Int, limit: Int = HKObjectQueryNoLimit) async -> [HKSample] {
        let from = Calendar.current.date(byAdding: .day, value: -days, to: Date())!
        let pred = HKQuery.predicateForSamples(withStart: from, end: Date())
        let sort = [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)]
        return await withCheckedContinuation { cont in
            let q = HKSampleQuery(sampleType: entry.sampleType, predicate: pred, limit: limit, sortDescriptors: sort) { _, r, _ in
                cont.resume(returning: r ?? [])
            }
            store.execute(q)
        }
    }

    func refreshAll() async {
        var out: [String: TypeSummary] = [:]
        for e in HealthTypeCatalog.entries {
            let s = await samples(for: e, days: days)
            var sum = TypeSummary(count: s.count)
            sum.earliest = s.last?.startDate
            sum.latest = s.first?.startDate
            for x in s { sum.sources[x.sourceRevision.source.name, default: 0] += 1 }
            out[e.id] = sum
        }
        summaries = out
    }

    func summaryText() -> String {
        var lines = ["Health PoC summary — last \(days) days"]
        for e in HealthTypeCatalog.entries {
            let s = summaries[e.id] ?? TypeSummary()
            let src = s.sources.map { "\($0.key)=\($0.value)" }.sorted().joined(separator: ", ")
            lines.append("\(e.group) | \(e.title): \(s.count) [\(src)]")
        }
        return lines.joined(separator: "\n")
    }

    // MARK: updates (observer + anchored query)
    private var observing = false
    private var anchors: [String: HKQueryAnchor] = {
        var d: [String: HKQueryAnchor] = [:]
        if let raw = UserDefaults.standard.dictionary(forKey: "anchors") as? [String: Data] {
            for (k, v) in raw { d[k] = try? NSKeyedUnarchiver.unarchivedObject(ofClass: HKQueryAnchor.self, from: v) }
        }
        return d
    }()

    private func persistAnchors() {
        var raw: [String: Data] = [:]
        for (k, v) in anchors { raw[k] = try? NSKeyedArchiver.archivedData(withRootObject: v, requiringSecureCoding: true) }
        UserDefaults.standard.set(raw, forKey: "anchors")
    }

    func startObservers() {
        guard !observing else { return }
        observing = true
        let frequent: Set<String> = [HKCategoryTypeIdentifier.sleepAnalysis.rawValue,
                                     HKCategoryTypeIdentifier.menstrualFlow.rawValue]
        for e in HealthTypeCatalog.entries {
            let obs = HKObserverQuery(sampleType: e.sampleType, predicate: nil) { [weak self] _, done, error in
                guard error == nil else { done(); return }
                Task { @MainActor in
                    await self?.fetchDelta(e)
                    done()
                }
            }
            store.execute(obs)
            store.enableBackgroundDelivery(for: e.sampleType,
                                           frequency: frequent.contains(e.id) ? .immediate : .hourly) { _, _ in }
        }
    }

    func fetchDelta(_ e: CatalogEntry) async {
        let anchor = anchors[e.id]
        let result: (added: Int, deleted: Int, anchor: HKQueryAnchor?) = await withCheckedContinuation { cont in
            let q = HKAnchoredObjectQuery(type: e.sampleType, predicate: nil, anchor: anchor, limit: HKObjectQueryNoLimit) { _, added, deleted, newAnchor, _ in
                cont.resume(returning: (added?.count ?? 0, deleted?.count ?? 0, newAnchor))
            }
            store.execute(q)
        }
        if let a = result.anchor { anchors[e.id] = a; persistAnchors() }
        // First run (no anchor) is the full backfill: record it but it is not an "update".
        guard anchor != nil, result.added + result.deleted > 0 else { return }
        let ev = UpdateEvent(date: Date(), type: e.title, added: result.added, deleted: result.deleted,
                             inBackground: UIApplication.shared.applicationState != .active)
        updates.append(ev)
        UpdateLogStore.save(updates)
    }

    func clearUpdates() { updates = []; UpdateLogStore.save([]) }
}
