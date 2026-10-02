import HealthKit

#if targetEnvironment(simulator)
/// Simulator-only synthetic data writer. Tagged poc_synthetic=true.
enum DebugSeeder {
    static func seed(store: HKHealthStore) async -> String {
        let cal = Calendar.current
        let meta: [String: Any] = ["poc_synthetic": true]
        var out: [HKSample] = []
        let sleepType = HKCategoryType(.sleepAnalysis)
        for d in 1...14 {
            let wake = cal.date(bySettingHour: 7, minute: 0, second: 0, of: cal.date(byAdding: .day, value: -d + 1, to: Date())!)!
            let hours = d % 3 == 0 ? 5.5 : 7.8
            let bed = wake.addingTimeInterval(-hours * 3600)
            let stages: [(HKCategoryValueSleepAnalysis, Double)] = [(.asleepCore, 0.45), (.asleepDeep, 0.2), (.asleepREM, 0.25), (.awake, 0.02), (.asleepCore, 0.08)]
            var t = bed
            for (v, f) in stages {
                let e = t.addingTimeInterval(f * hours * 3600)
                out.append(HKCategorySample(type: sleepType, value: v.rawValue, start: t, end: min(e, wake), metadata: meta))
                t = e
            }
        }
        for d in 0..<30 where d % 10 == 0 {
            let s = cal.date(byAdding: .day, value: -d, to: cal.startOfDay(for: Date()))!
            for i in 0..<4 {
                let a = s.addingTimeInterval(Double(i) * 86400)
                out.append(HKCategorySample(type: HKCategoryType(.menstrualFlow), value: HKCategoryValueMenstrualFlow.medium.rawValue,
                                            start: a, end: a.addingTimeInterval(86399), metadata: [HKMetadataKeyMenstrualCycleStart: i == 0, "poc_synthetic": true]))
            }
        }
        for d in 0..<14 {
            let t = cal.date(bySettingHour: 15, minute: 0, second: 0, of: cal.date(byAdding: .day, value: -d, to: Date())!)!
            out.append(HKQuantitySample(type: HKQuantityType(.dietaryCaffeine), quantity: HKQuantity(unit: .gramUnit(with: .milli), doubleValue: 95), start: t, end: t, metadata: meta))
            out.append(HKQuantitySample(type: HKQuantityType(.heartRate), quantity: HKQuantity(unit: HKUnit.count().unitDivided(by: .minute()), doubleValue: Double(60 + d)), start: t, end: t, metadata: meta))
            out.append(HKQuantitySample(type: HKQuantityType(.stepCount), quantity: HKQuantity(unit: .count(), doubleValue: Double(4000 + d * 300)), start: t.addingTimeInterval(-3600), end: t, metadata: meta))
        }
        do { try await store.save(out); return "Seeded \(out.count) synthetic samples" }
        catch { return "Seed failed: \(error.localizedDescription)" }
    }
}
#endif
