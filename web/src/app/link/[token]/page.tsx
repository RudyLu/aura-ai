import { headers } from 'next/headers';
import { linkUrls, TOKEN } from '@/server/healthLink';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Link Apple Health | Aura.ai' };

// Opened from the QR code or "Link Apple Health". With the app installed (and universal
// links set up) iOS opens the app instead of this page; otherwise this page offers the
// app's own link and explains the alternatives.
export default async function LinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const h = await headers();
  const origin = process.env.PUBLIC_URL?.replace(/\/$/, '') || `${h.get('x-forwarded-proto')?.split(',')[0] || 'http'}://${h.get('x-forwarded-host') || h.get('host')}`;
  const ok = TOKEN.test(token);
  return (
    <div className="phone">
      <main className="linkpage">
        <p className="wordmark"><span className="brand-aura" />Aura<span className="brand-ai">.ai</span></p>
        <p className="eyebrow">Apple Health</p>
        <h1>Link Apple Health with the Aura app</h1>
        {ok ? (
          <>
            <p>The Aura iPhone app reads Apple Health on this phone and sends daily totals only to your Aura session: sleep hours, exercise minutes and period dates. You choose which.</p>
            <a className="primary linkbutton" href={linkUrls(origin, token).appUrl}>Open the Aura app</a>
            <p className="soft">Nothing happens? The Aura app isn’t installed on this iPhone. Go back to Aura in your browser and choose <b>export.xml</b> instead, or keep using simulated data.</p>
          </>
        ) : <p>This link isn’t valid. Start again from Aura in your browser.</p>}
        <p className="soft">This link works once and expires after 10 minutes.</p>
      </main>
    </div>
  );
}
