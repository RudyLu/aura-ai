# HealthConnectorPoC
iOS HealthKit feasibility PoC (PRD v0.2 §1 資料入口研究). Plan: ~/.claude/plans/build-a-connector-ios-wild-parrot.md

    xcodegen generate
    xcodebuild -scheme HealthConnectorPoC -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -derivedDataPath build build

Simulator: Overview → Request Authorization (Turn On All → Allow) → Seed synthetic data.
Device: set DEVELOPMENT_TEAM in project.yml, regenerate, run on iPhone.
Note: ENABLE_DEBUG_DYLIB=NO is required, otherwise the HealthKit entitlement is missing from the main executable on simulator.

## Link to the Aura web app

The app is the Apple Health connector for the web demo (`../web`). In Aura (any browser): Data sources › Use your real Apple Health data › Link with the Aura iOS app. Scan the QR code (desktop) or tap Open the Aura app (iPhone); the app opens `LinkView`, asks for sleep / exercise / period permission and sends 60 days of daily totals to that browser session.

Simulator test against a local dev server (seed data first; take the token from the QR sheet):

    xcrun simctl openurl booted "aura://link?t=<token>&h=http%3A%2F%2Flocalhost%3A3000"

Universal links (`https://<host>/link/<token>` opening the app) need `DEVELOPMENT_TEAM` here and `APPLE_TEAM_ID` on the server; the associated domain in `project.yml` is the current Cloud Run host.
