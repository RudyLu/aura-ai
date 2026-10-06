import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// apple-app-site-association (served at /.well-known/, see next.config.ts) so that
// /link/<token> opens the Aura iOS app when it's installed. Needs APPLE_TEAM_ID.
export function GET() {
  const team = process.env.APPLE_TEAM_ID;
  if (!team) return NextResponse.json({ error: 'APPLE_TEAM_ID is not set' }, { status: 404 });
  const app = `${team}.${process.env.IOS_BUNDLE_ID || 'com.rudy.healthconnectorpoc'}`;
  return NextResponse.json({ applinks: { details: [{ appIDs: [app], components: [{ '/': '/link/*' }] }] } });
}
