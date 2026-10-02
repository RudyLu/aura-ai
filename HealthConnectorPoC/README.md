# HealthConnectorPoC
iOS HealthKit feasibility PoC (PRD v0.2 §1 資料入口研究). Plan: ~/.claude/plans/build-a-connector-ios-wild-parrot.md

    xcodegen generate
    xcodebuild -scheme HealthConnectorPoC -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -derivedDataPath build build

Simulator: Overview → Request Authorization (Turn On All → Allow) → Seed synthetic data.
Device: set DEVELOPMENT_TEAM in project.yml, regenerate, run on iPhone.
Note: ENABLE_DEBUG_DYLIB=NO is required, otherwise the HealthKit entitlement is missing from the main executable on simulator.
