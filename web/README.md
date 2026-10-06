# Aura.ai web demo

A working version of the Aura.ai prototype (Ellie's design, kept in `prototype-ref/` for reference): Next.js on Cloud Run, Gemini on Vertex AI, Firestore and Cloud Storage. It looks and flows like the prototype; the parts that were faked are now real.

| Prototype | This app |
|---|---|
| Aura's replies were regex presets | Gemini writes replies from your own records, cites the facts it used, and every reply passes a grounding check (below) |
| Tapping a sample photo pre-filled fields | Gemini reads the actual photo (sample or your own) and proposes name, note and "caffeinated?"; you confirm before anything is saved |
| Records in localStorage | Records saved per anonymous visitor session (Firestore); photos in Cloud Storage; reset affects only you |
| No safety layer | Rules + Gemini classifier before every reply, output check after (PRD §7.3) |
| Simulated Apple Health | Still available (labeled "simulated"), plus real data: link the Aura iOS app (opt-in, from any browser) or import `export.xml` in the browser |

## Run locally

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000. Without `GOOGLE_CLOUD_PROJECT` the app runs fully offline: records go to `web/.data/`, Aura uses the prototype's preset replies (labeled "Preset reply"), and photos aren't read automatically.

To use Gemini locally, set `GOOGLE_CLOUD_PROJECT` (and optionally `GEMINI_MODEL`) in `web/.env.local`, then authenticate once:

```bash
gcloud auth application-default login
```

Tests (domain logic, safety rules, grounding):

```bash
npm test
```

The discovery tests include golden values captured from the prototype itself: demo days 1, 4 and 10 must produce exactly the prototype's comparisons (for example, Day 10: under 7 h of sleep 2.5 over 4 days vs 7 h or more 3.7 over 3 days).

## Deploy to Cloud Run

```bash
PROJECT=your-project-id
REGION=us-central1
gcloud config set project $PROJECT
gcloud services enable run.googleapis.com aiplatform.googleapis.com firestore.googleapis.com storage.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
gcloud firestore databases create --location=$REGION
gcloud storage buckets create gs://$PROJECT-aura-photos --location=$REGION --uniform-bucket-level-access

gcloud iam service-accounts create aura-web
SA=aura-web@$PROJECT.iam.gserviceaccount.com
for role in roles/aiplatform.user roles/datastore.user; do
  gcloud projects add-iam-policy-binding $PROJECT --member=serviceAccount:$SA --role=$role
done
gcloud storage buckets add-iam-policy-binding gs://$PROJECT-aura-photos --member=serviceAccount:$SA --role=roles/storage.objectAdmin

gcloud run deploy aura-web --source web --region $REGION --service-account $SA --allow-unauthenticated \
  --set-env-vars GOOGLE_CLOUD_PROJECT=$PROJECT,GOOGLE_CLOUD_LOCATION=global,GEMINI_MODEL=gemini-2.5-flash,PHOTO_BUCKET=$PROJECT-aura-photos
```

No API key is stored anywhere: Cloud Run's service account calls Vertex AI, Firestore and Cloud Storage. Check that `GEMINI_MODEL` is available in your project and location before deploying.

### Current deployment

Live at https://aura-web-664697749037.us-central1.run.app (project `aura-ai-510710`, `us-central1`) with Gemini on: `gemini-2.5-flash` on Vertex AI, location `global`. One setup fix for new projects: the default compute service account needs build permissions, or `gcloud run deploy --source` fails with `PERMISSION_DENIED`.

```bash
PROJECT=aura-ai-510710
COMPUTE_SA=$(gcloud projects describe $PROJECT --format='value(projectNumber)')-compute@developer.gserviceaccount.com
for role in roles/cloudbuild.builds.builder roles/storage.objectViewer roles/artifactregistry.writer roles/logging.logWriter; do
  gcloud projects add-iam-policy-binding $PROJECT --member=serviceAccount:$COMPUTE_SA --role=$role --condition=None
done

gcloud run deploy aura-web --source web --region us-central1 --service-account aura-web@$PROJECT.iam.gserviceaccount.com --allow-unauthenticated \
  --set-env-vars GOOGLE_CLOUD_PROJECT=$PROJECT,GOOGLE_CLOUD_LOCATION=global,GEMINI_MODEL=gemini-2.5-flash,PHOTO_BUCKET=$PROJECT-aura-photos
```

Model notes (October 2026): `gemini-3.8-flash` is GA and works (`GEMINI_MODEL=gemini-3.8-flash`, thinking is set to `LOW` automatically), but on this project it was slow and erratic (4 s to several minutes per call), so the safety classifier's 8 s limit often failed. Calls are bounded with `GEMINI_THINKING_LEVEL` (Gemini 3, default `LOW`) or `GEMINI_THINKING_BUDGET` (Gemini 2.5, default 1024 tokens). Vertex's shared capacity sometimes answers 429; each call retries once.

## Architecture

```
src/domain/   Pure TypeScript shared by browser and server (ported from the prototype)
  topics.ts     the three observation topics, concerns, ranking
  state.ts      records: observations, check-ins, entries, plans, feedback
  health.ts     sample data, export.xml streaming parser, daily() accessor
  discovery.ts  descriptive comparisons (MIN_DAYS 4, MIN_GROUP 2, gap ≥ 0.5)
  demo.ts       Day 1 / 4 / 10 timelines
  steps.ts      the reviewed step whitelist Aura may choose from
src/server/
  session.ts    anonymous httpOnly cookie → one record set per visitor
  repo.ts       Firestore + Cloud Storage (or web/.data/ locally)
  gemini.ts     Vertex AI client, structured JSON output
  safety.ts     PRD §7.3 safety floor
  agent.ts      Aura's reply: facts → Gemini → grounding check → fallback
  vision.ts     food photo → fields to confirm
  healthLink.ts one-time Apple Health link tokens and the iOS app's payload
src/app/api/   session (GET/PUT/DELETE), aura (POST), photo (POST, GET /[id]),
               health/link (POST, GET /[token]), health/sync (POST, iOS app), health/import (DELETE)
src/app/link/  /link/<token>: opened from the QR code; hands off to the iOS app
src/ui/        React port of the prototype's screens; CSS reused verbatim
```

### How Aura stays grounded (PRD §3.2)

1. Code computes everything numeric: `analyze()` comparisons, the last 7 days of records, the current step's feedback. Each becomes a **fact with an ID** (`cmp:evening-energy:short-sleep`, `rec:week`, `plan:…`).
2. Gemini returns JSON: `reply`, `cited` fact IDs, an optional `stepId` from the whitelist, an optional action.
3. The server rejects the reply if a cited ID doesn't exist, **any number in the reply isn't in a cited fact** (or the user's own words), the wording claims causes, diagnoses, prescribes or reassures, or the step isn't allowed (a finding step needs that finding to exist).
4. One retry with the problems listed. If it still fails, Aura shows a summary built only from code, with no step.

Discovery cards are always rendered by code; Gemini never produces the numbers on screen.

### Safety (PRD §7.3)

- **Emergency** wording (sudden severe headache, chest pain, breathing trouble, stroke signs, self-harm) gets a fixed message at once, without waiting for the model.
- **Medication, dosing or diagnosis** requests get an out-of-scope reply.
- **Professional-assessment** cases (heavy or irregular bleeding, persistent or worsening symptoms) pause steps.
- **Reporting "worse"**, in chat or in step feedback, stops the active step.
- Rules handle negation ("no chest pain"). A Gemini classifier then reads meaning and past events; it can raise a level but never lower a rule match.
- If the classifier fails, no new step is offered.
- Aura's own reply is also checked before it's shown.

### Linking real Apple Health (iOS app)

People start in any browser; Apple Health is an opt-in added later. A browser can't read HealthKit, so the iOS app (`../HealthConnectorPoC`) is the connector:

1. Data sources (or setup) › Use your real Apple Health data › **Link with the Aura iOS app**. The server makes a one-time token for this session (10 minutes).
2. Desktop shows a QR code for `/link/<token>`; on iPhone the button opens `aura://link?t=…&h=…` directly.
3. The app shows what it will send, asks for HealthKit permission, computes 60 days of daily totals on the phone (sleep via `SleepNights.build`, exercise minutes, period dates) and POSTs them to `/api/health/sync` with the token.
4. The browser polls the link, adopts the import (`via: 'ios-app'`, labeled "Apple Health · via iOS app") and closes the sheet. A tab opened later picks it up from `GET /api/session`.

The import is stored apart from the browser-owned State (Firestore `healthImports/{sid}`, link tokens in `healthLinks`), so a browser save can't overwrite it. Tokens work once; another session can't read them; reset deletes both.

Optional env: `PUBLIC_URL` (origin used in links, if the proxy headers are wrong), `APPLE_TEAM_ID` (serves `/.well-known/apple-app-site-association` so `/link/<token>` opens the app directly as a universal link; without it the link page shows an "Open the Aura app" button).

### Data handling

- Sessions are isolated by cookie. Photos are served only to the session that uploaded them.
- "Delete all records and restart" removes this session's document and photos.
- Apple Health `export.xml` is parsed in the browser; the iOS app computes totals on the phone. Only daily totals are saved.
- Each session gets a Gemini call budget (`AI_CALLS_PER_HOUR`).

## Known limits

- Real Apple Health needs the iOS app on the visitor's iPhone (TestFlight or the presenter's phone; App Clips can't use HealthKit). Others use `export.xml` or simulated data. A link sends a one-time snapshot; there's no background resync yet.
- The grounding check verifies numbers, citations, steps and banned wording; it can't catch every semantic error in free text.
- The safety rules and copy follow the PRD draft and still need the content review named in PRD §7.3.
- The demo uses the name "Alex" and fictional records throughout.
