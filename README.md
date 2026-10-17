# Aura

Aura is a wellbeing journal. People record how they feel (evening energy, restedness on waking, afternoon sleepiness, perceived stress, productivity), what they eat and drink, and optionally Apple Health data. Aura shows simple comparisons from those records and talks them through with the user. It does not diagnose, prescribe or claim causes.

**Live demo:** https://aura-web-664697749037.us-central1.run.app

| Part | Stack |
|---|---|
| Web app (`web/`) | Next.js 16, React 19, TypeScript |
| Hosting | Cloud Run (scales to zero) |
| Model | Gemini 2.5 Flash on Vertex AI, structured JSON output |
| Storage | Firestore (records), Cloud Storage (food photos) |
| Apple Health connector (`HealthConnectorPoC/`) | SwiftUI + HealthKit iOS app |

## Try it

Cold start can take 20–60 s on the first request. All data shown in Demo mode is fictional ("Alex").

1. Open the demo, finish onboarding, and choose **Demo mode** for 10 days of sample history. Or start empty in Personal mode and record your own check-ins.
2. Move through Day 1 / 4 / 10 in Demo mode and check Explore:

   | Day | Expected |
   |---|---|
   | 1 | Not enough data yet; no comparison is shown |
   | 4 | Still collecting: 3 answered days, below the 4-day minimum |
   | 10 | Evening energy: under 7 h of sleep averages **2.5** over 4 days vs 7 h or more **3.7** over 3 days. Exercise shows no difference |

   These values are pinned by tests (`web/src/domain/discovery.test.ts`).
3. Open Aura and send the messages below.

| Message | Expected behavior |
|---|---|
| `Why is my energy low in the evenings?` | Reply cites the sleep comparison with the same numbers as Explore; no causal claim |
| `I feel drained` | Asks which feeling you mean (at most twice), then offers topics |
| `Should I take melatonin?` | Fixed out-of-scope reply; no step offered |
| `I have sudden chest pain` | Fixed emergency message, returned before any model call |
| `No chest pain, just tired` | Negation is handled; normal reply |
| `The step made me feel worse` | Active step is paused |

4. Attach a food photo (sample or your own). Gemini proposes name, note and whether it contains caffeine; nothing is saved until you confirm.
5. On Day 10, open the plan and press **Review with Aura**. Aura recommends continue / adjust / observe / stop with 1–4 reasons drawn from your feedback.

**Limits for judges:** each browser session can make 60 Gemini calls per hour (chat, photo and review combined). After that the app says so and keeps working without AI. Vertex AI occasionally returns 429 under shared load; each call retries once, then the app shows an explicit "unavailable" state instead of a made-up answer.

## How answers stay grounded

Gemini never computes numbers. Code does, and the model only words them.

1. The server builds a list of **facts with IDs** from the user's own records: comparisons (`cmp:…`), the last 7 days (`rec:week`), plan feedback (`fb:…`). Each fact is tagged as `user_report`, `verified_summary`, `allowed_comparison` or `context`.
2. Gemini returns JSON: `reply`, `cited` fact IDs, an optional action from a fixed menu, and the topic the message is about.
3. The server rejects the reply if:
   - a cited ID doesn't exist,
   - any number in the reply isn't in a cited fact or the user's own message,
   - the wording claims causes, diagnoses, prescribes or reassures,
   - the action isn't on the menu, isn't allowed by safety, or belongs to another topic.
4. On rejection, Gemini gets one retry with the problems listed. If that also fails, Aura shows a summary built from code only.

Discovery cards on screen are rendered by code, never by the model. Comparisons need at least 4 answered days, 2 days per group and a gap of 0.5 or more. Stress and productivity have no comparisons configured, so Aura only describes those records. Unlogged caffeine is treated as unknown, not as zero. Menstrual dates reach the model only if the user turns that on.

Code: `web/src/server/agent.ts` (chat), `web/src/server/review.ts` (Day 10 review), `web/src/domain/uiDiscovery.ts` (comparisons).

## Safety

Every message goes through two checks before a reply is generated (`web/src/server/safety.ts`):

- **Rules** (instant, no model call): emergency signs (chest pain, breathing trouble, stroke signs, sudden severe headache, self-harm) return a fixed message right away. Medication and diagnosis questions get an out-of-scope reply. Persistent symptoms or heavy/irregular bleeding pause steps and point to a professional. Rules handle negation ("no chest pain").
- **Gemini classifier**: reads meaning and context. It can raise a rule's level but never lower it. If it fails or times out (8 s), no new step is offered.

Aura's own reply is also checked before it is shown. A reported "worse" in chat or feedback stops the active step.

## Latency

A chat turn makes up to three model calls (safety classifier, reply, one retry), so we bound each one:

- Emergency and out-of-scope messages are answered by rules without waiting for Gemini.
- Model thinking is capped (`thinkingBudget` 1024 for Gemini 2.5, `thinkingLevel: LOW` for Gemini 3).
- Hard timeouts: 8 s safety classifier, 20 s reply (shared across the retry), 25 s photo reading and review; the browser aborts at 30 s and offers retry without duplicating the message.
- We tried `gemini-3.8-flash`; on our project it ranged from 4 s to several minutes per call and broke the 8 s classifier limit, so the deployment stays on `gemini-2.5-flash`.

<!-- TODO: add measured p50/p95 end-to-end latency for a chat turn. -->

## What Aura can and can't do

**Can:** record five feeling topics, food/drink (by hand or photo), and sleep, exercise, HRV and cycle data; show descriptive comparisons; explain them in chat; suggest recording or observation actions; review a 10-day plan.

**Can't / won't:**
- Diagnose, recommend medication or supplements, or say one thing caused another.
- Suggest new lifestyle interventions. Only recording and observation actions are enabled until the intervention list has been reviewed.
- Read Apple Health from a browser. Real HealthKit data needs the iOS app (TestFlight / presenter's phone) or an uploaded `export.xml`. Linking sends a one-time 60-day snapshot; there is no background sync.
- Catch every semantic error. The grounding check covers numbers, citations, actions and banned wording, not all meaning.

## Data and privacy

- No sign-in. An anonymous httpOnly cookie maps each visitor to their own records; Demo and Personal data are stored separately.
- "Delete all records and restart" removes that session's records and photos.
- `export.xml` is parsed in the browser. The iOS app computes daily totals on the phone and sends only those.
- All demo data is synthetic and labeled as such.
- **No API keys or credentials in this repo.** Cloud Run's service account calls Vertex AI, Firestore and Cloud Storage through Application Default Credentials.

## Run locally

Requires Node.js 22+.

```bash
cd web
npm ci
STORAGE=file GEMINI_DISABLED=1 npm run dev   # offline: no cloud, no AI
npm test                                     # domain logic, safety, grounding, API contracts
```

To use Gemini locally, set `GOOGLE_CLOUD_PROJECT` in `web/.env.local` (see `web/.env.example`) and run `gcloud auth application-default login`.

Deploy: `web/deploy.sh` (runs typecheck and tests, deploys to Cloud Run, smoke-checks `/`). Full GCP setup is in [web/README.md](web/README.md).

## Repository

```
web/                 Next.js app (UI, API routes, agent, safety)
  src/domain/        Pure TypeScript shared by browser and server: topics, records, comparisons, demo timeline
  src/server/        Gemini client, agent, review, safety, storage, Apple Health link
  src/app/api/       HTTP routes
  docs/              Integration notes and API contracts
HealthConnectorPoC/  iOS app that sends Apple Health daily totals to a web session
```
