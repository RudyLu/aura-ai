#!/usr/bin/env bash
# Deploy the web app to Cloud Run (see README "Deploy to Cloud Run").
# Usage: ./deploy.sh [--skip-checks]
# Override with env: PROJECT, REGION, SERVICE, GEMINI_MODEL, GOOGLE_CLOUD_LOCATION.
set -euo pipefail

PROJECT="${PROJECT:-aura-ai-510710}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-aura-web}"
GEMINI_MODEL="${GEMINI_MODEL:-gemini-2.5-flash}"
GOOGLE_CLOUD_LOCATION="${GOOGLE_CLOUD_LOCATION:-global}"
SA="aura-web@${PROJECT}.iam.gserviceaccount.com"
PHOTO_BUCKET="${PHOTO_BUCKET:-${PROJECT}-aura-photos}"

cd "$(dirname "$0")"

if ! gcloud auth list --filter=status:ACTIVE --format='value(account)' | grep -q .; then
  echo "No active gcloud account. Run: gcloud auth login" >&2
  exit 1
fi

if [[ "${1:-}" != "--skip-checks" ]]; then
  echo "==> Typecheck and tests"
  npm run typecheck
  npm test
fi

echo "==> Deploying $SERVICE to $PROJECT ($REGION)"
# --update-env-vars keeps any other vars already set on the service (PUBLIC_URL, APPLE_TEAM_ID, ...).
gcloud run deploy "$SERVICE" \
  --project "$PROJECT" \
  --region "$REGION" \
  --source . \
  --service-account "$SA" \
  --allow-unauthenticated \
  --update-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT,GOOGLE_CLOUD_LOCATION=$GOOGLE_CLOUD_LOCATION,GEMINI_MODEL=$GEMINI_MODEL,PHOTO_BUCKET=$PHOTO_BUCKET" \
  --quiet

URL=$(gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format='value(status.url)')
echo "==> Smoke check $URL"
STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$URL/")
if [[ "$STATUS" != "200" ]]; then
  echo "GET / returned $STATUS" >&2
  exit 1
fi
echo "Deployed: $URL"
