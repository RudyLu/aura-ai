import HealthKit

struct CatalogEntry: Identifiable {
    enum Kind { case category, quantity, workout, stateOfMind }
    let id: String
    let title: String
    let group: String
    let kind: Kind
    let sampleType: HKSampleType
    let unit: HKUnit?
}

enum HealthTypeCatalog {
    private static func cat(_ id: HKCategoryTypeIdentifier, _ title: String, _ group: String) -> CatalogEntry {
        CatalogEntry(id: id.rawValue, title: title, group: group, kind: .category,
                     sampleType: HKCategoryType(id), unit: nil)
    }
    private static func qty(_ id: HKQuantityTypeIdentifier, _ title: String, _ group: String, _ unit: HKUnit) -> CatalogEntry {
        CatalogEntry(id: id.rawValue, title: title, group: group, kind: .quantity,
                     sampleType: HKQuantityType(id), unit: unit)
    }

    static let entries: [CatalogEntry] = {
        var e: [CatalogEntry] = [
            cat(.sleepAnalysis, "Sleep analysis", "Sleep (F6)"),
            cat(.menstrualFlow, "Menstrual flow", "Menstrual (F5)"),
            cat(.intermenstrualBleeding, "Intermenstrual bleeding", "Menstrual (F5)"),
            cat(.headache, "Headache", "Menstrual (F5)"),
            cat(.fatigue, "Fatigue", "Menstrual (F5)"),
            cat(.abdominalCramps, "Abdominal cramps", "Menstrual (F5)"),
            cat(.moodChanges, "Mood changes", "Menstrual (F5)"),
            cat(.sleepChanges, "Sleep changes", "Menstrual (F5)"),
            qty(.dietaryCaffeine, "Caffeine", "Diet (F4)", .gramUnit(with: .milli)),
            qty(.dietaryWater, "Water", "Diet (F4)", .literUnit(with: .milli)),
            qty(.heartRate, "Heart rate", "Vitals", HKUnit.count().unitDivided(by: .minute())),
            qty(.restingHeartRate, "Resting heart rate", "Vitals", HKUnit.count().unitDivided(by: .minute())),
            qty(.heartRateVariabilitySDNN, "HRV (SDNN)", "Vitals", .secondUnit(with: .milli)),
            qty(.respiratoryRate, "Respiratory rate", "Vitals", HKUnit.count().unitDivided(by: .minute())),
            qty(.oxygenSaturation, "Oxygen saturation", "Vitals", .percent()),
            qty(.appleSleepingWristTemperature, "Sleeping wrist temp", "Vitals", .degreeCelsius()),
            qty(.stepCount, "Steps", "Activity", .count()),
            qty(.activeEnergyBurned, "Active energy", "Activity", .kilocalorie()),
            qty(.appleExerciseTime, "Exercise time", "Activity", .minute()),
            CatalogEntry(id: "workout", title: "Workouts", group: "Activity", kind: .workout,
                         sampleType: HKObjectType.workoutType(), unit: nil),
            cat(.mindfulSession, "Mindful session", "Mind"),
        ]
        if #available(iOS 18.0, *) {
            e.append(CatalogEntry(id: "stateOfMind", title: "State of mind", group: "Mind",
                                  kind: .stateOfMind, sampleType: HKObjectType.stateOfMindType(), unit: nil))
        }
        return e
    }()

    static var groups: [String] {
        var seen: [String] = []
        for e in entries where !seen.contains(e.group) { seen.append(e.group) }
        return seen
    }
    static var readTypes: Set<HKObjectType> { Set(entries.map { $0.sampleType }) }
}
