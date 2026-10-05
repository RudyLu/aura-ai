'use client';
// The app shell (ported from app.js shell()/render()).
import { useEffect } from 'react';
import { load, ui, useApp } from './store';
import { dispatch } from './actions';
import { Splash, Onboarding } from './onboarding';
import { Today } from './today';
import { Explore } from './explore';
import { Aura } from './aura';
import { Modal } from './sheets';

export default function App() {
  useApp();
  useEffect(() => {
    load();
    // Hide the floating navigation while typing, so the phone keyboard never covers the composer.
    const on = (e: FocusEvent) => { if ((e.target as HTMLElement).matches?.('main input, main textarea, .sheet input, .sheet textarea')) document.body.classList.add('typing'); };
    const off = () => setTimeout(() => { if (!document.activeElement || !(document.activeElement as HTMLElement).matches('input, textarea')) document.body.classList.remove('typing'); }, 0);
    document.addEventListener('focusin', on); document.addEventListener('focusout', off);
    return () => { document.removeEventListener('focusin', on); document.removeEventListener('focusout', off); };
  }, []);
  if (!ui.ready) return <div className="phone" aria-busy="true" />;
  const body = ui.page === 'splash' ? <Splash /> : ui.page === 'onboarding' ? <Onboarding /> : ui.tab === 'explore' ? <Explore /> : ui.tab === 'aura' ? <Aura /> : <Today />;
  return (
    <>
      <div className="phone">
        {body}
        {ui.page === 'app' ? (
          <nav aria-label="Main navigation">
            {([['today', 'Today'], ['explore', 'Explore'], ['aura', 'Aura']] as const).map(([id, t]) => (
              <button key={id} type="button" className={ui.tab === id ? 'current' : ''} aria-current={ui.tab === id ? 'page' : undefined} onClick={e => dispatch('tab', id, {}, e.currentTarget)}>
                {id === 'aura' ? <span className="nav-aura" aria-hidden="true" /> : null}{t}
              </button>
            ))}
          </nav>
        ) : null}
      </div>
      {ui.modal ? <Modal /> : null}
      <div id="toast" role="status" aria-live="polite" className={ui.toast ? 'show' : ''}>{ui.toast || ''}</div>
      {ui.saveError ? <div className="saveerror" role="alert">Not saved: {ui.saveError}</div> : null}
    </>
  );
}
