import HealthKit

struct SleepNight: Identifiable {
    var id: Date { wakeDay }
    let wakeDay: Date
    let bedtime: Date
    let wake: Date
    let asleepHours: Double
    let stageMinutes: [String: Double]
    let source: String
    let otherSources: [String]
    var under7h: Bool { asleepHours < 7 }
}

enum SleepNights {
    /// Groups sleep samples by wake-up local date. Main sleep = longest cluster ending before 14:00.
    /// Asleep time excludes awake/inBed; overlaps merged; primary source preferred (Watch), others reported as not counted.
    static func build(from samples: [HKCategorySample]) -> [SleepNight] {
        let cal = Calendar.current
        let asleepValues: Set<Int> = [HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue,
                                      HKCategoryValueSleepAnalysis.asleepCore.rawValue,
                                      HKCategoryValueSleepAnalysis.asleepDeep.rawValue,
                                      HKCategoryValueSleepAnalysis.asleepREM.rawValue]
        let asleep = samples.filter { asleepValues.contains($0.value) }
        let bySource = Dictionary(grouping: asleep) { $0.sourceRevision.source.name }
        guard !bySource.isEmpty else { return [] }
        let primary = bySource.keys.first { $0.localizedCaseInsensitiveContains("watch") }
            ?? bySource.max { $0.value.count < $1.value.count }!.key
        let used = bySource[primary]!.sorted { $0.startDate < $1.startDate }

        // cluster segments with gaps < 60 min
        var clusters: [[HKCategorySample]] = []
        for s in used {
            if let last = clusters.last?.last, s.startDate.timeIntervalSince(last.endDate) < 3600 {
                clusters[clusters.count - 1].append(s)
            } else { clusters.append([s]) }
        }
        var nights: [Date: SleepNight] = [:]
        for c in clusters {
            let wake = c.map(\.endDate).max()!
            let bed = c.map(\.startDate).min()!
            guard cal.component(.hour, from: wake) < 14 else { continue } // naps/afternoon go elsewhere
            // merge overlaps
            var merged: [(Date, Date)] = []
            for s in c.sorted(by: { $0.startDate < $1.startDate }) {
                if let l = merged.last, s.startDate <= l.1 { merged[merged.count - 1].1 = max(l.1, s.endDate) }
                else { merged.append((s.startDate, s.endDate)) }
            }
            let secs = merged.reduce(0) { $0 + $1.1.timeIntervalSince($1.0) }
            var stages: [String: Double] = [:]
            for s in c { stages[SignalRecord.label(for: s), default: 0] += s.endDate.timeIntervalSince(s.startDate) / 60 }
            let day = cal.startOfDay(for: wake)
            let night = SleepNight(wakeDay: day, bedtime: bed, wake: wake, asleepHours: secs / 3600,
                                   stageMinutes: stages, source: primary,
                                   otherSources: bySource.keys.filter { $0 != primary }.sorted())
            if let ex = nights[day], ex.asleepHours >= night.asleepHours { continue }
            nights[day] = night
        }
        return nights.values.sorted { $0.wakeDay > $1.wakeDay }
    }
}
