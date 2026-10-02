import HealthKit

/// Normalized record shaped like PRD §4 Signal/Log.
struct SignalRecord: Identifiable {
    let id: UUID                 // HK sample uuid = source ID for dedup
    let type: String
    let value: Double?
    let unit: String?
    let categoryLabel: String?
    let start: Date
    let end: Date
    let timeZone: String
    let sourceName: String
    let sourceBundleId: String
    let sourceVersion: String?
    let device: String?
    let wasUserEntered: Bool
    let metadata: [String: String]
    let fetchedAt: Date

    init(sample: HKSample, entry: CatalogEntry) {
        id = sample.uuid
        type = entry.title
        start = sample.startDate
        end = sample.endDate
        let rev = sample.sourceRevision
        sourceName = rev.source.name
        sourceBundleId = rev.source.bundleIdentifier
        sourceVersion = rev.version
        device = sample.device.map { [$0.name, $0.model, $0.manufacturer].compactMap { $0 }.joined(separator: " / ") }
        var md: [String: String] = [:]
        for (k, v) in sample.metadata ?? [:] { md[k] = "\(v)" }
        metadata = md
        wasUserEntered = (sample.metadata?[HKMetadataKeyWasUserEntered] as? NSNumber)?.boolValue ?? false
        timeZone = (sample.metadata?[HKMetadataKeyTimeZone] as? String) ?? TimeZone.current.identifier + " (device)"
        fetchedAt = Date()

        if let q = sample as? HKQuantitySample, let u = entry.unit {
            value = q.quantity.doubleValue(for: u); unit = u.unitString; categoryLabel = nil
        } else if let c = sample as? HKCategorySample {
            value = Double(c.value); unit = nil
            categoryLabel = SignalRecord.label(for: c)
        } else if let w = sample as? HKWorkout {
            value = w.duration / 60; unit = "min"; categoryLabel = "activityType \(w.workoutActivityType.rawValue)"
        } else {
            value = nil; unit = nil; categoryLabel = nil
        }
    }

    static func label(for c: HKCategorySample) -> String {
        if c.categoryType.identifier == HKCategoryTypeIdentifier.sleepAnalysis.rawValue,
           let v = HKCategoryValueSleepAnalysis(rawValue: c.value) {
            switch v {
            case .inBed: return "inBed"
            case .awake: return "awake"
            case .asleepCore: return "core"
            case .asleepDeep: return "deep"
            case .asleepREM: return "REM"
            case .asleepUnspecified: return "asleepUnspecified"
            @unknown default: return "sleep(\(c.value))"
            }
        }
        return "value \(c.value)"
    }
}
