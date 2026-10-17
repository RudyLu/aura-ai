import type { Metadata, Viewport } from 'next';
import '@/styles/flow.css';
import '@/styles/aura.css';
import '@/styles/app.css';
import '@/styles/web.css';

export const metadata: Metadata = {
  title: 'Aura.ai | Understand how you live',
  description: 'Aura.ai. Understand how you live. Connect everyday details, choose a small step, and reflect.',
  icons: { icon: { url: '/assets/brand/aura-heart-mark-v1-64.png', type: 'image/png' } }
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', interactiveWidget: 'resizes-content' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
