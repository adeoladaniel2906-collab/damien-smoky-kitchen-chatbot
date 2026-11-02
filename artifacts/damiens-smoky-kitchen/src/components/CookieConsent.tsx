import { useEffect, useState } from "react";
import { X } from "lucide-react";

type CookiePreferences = {
  version: 1;
  essential: true;
  analytics: boolean;
  marketing: boolean;
  savedAt: string;
};

const STORAGE_KEY = "dsk-cookie-consent-v1";
const OPEN_EVENT = "dsk:open-cookie-settings";

function readPreferences(): CookiePreferences | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<CookiePreferences>;
    if (value.version !== 1 || value.essential !== true || typeof value.analytics !== "boolean" || typeof value.marketing !== "boolean") return null;
    return value as CookiePreferences;
  } catch {
    return null;
  }
}

export function hasOptionalCookieConsent(category: "analytics" | "marketing"): boolean {
  return readPreferences()?.[category] === true;
}

export function CookieConsent() {
  const initial = readPreferences();
  const [open, setOpen] = useState(initial === null);
  const [analytics, setAnalytics] = useState(initial?.analytics ?? false);
  const [marketing, setMarketing] = useState(initial?.marketing ?? false);

  useEffect(() => {
    const show = () => {
      const saved = readPreferences();
      setAnalytics(saved?.analytics ?? false);
      setMarketing(saved?.marketing ?? false);
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, show);
    return () => window.removeEventListener(OPEN_EVENT, show);
  }, []);

  const save = (nextAnalytics: boolean, nextMarketing: boolean) => {
    const preferences: CookiePreferences = {
      version: 1,
      essential: true,
      analytics: nextAnalytics,
      marketing: nextMarketing,
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // If storage is unavailable, the current page still works without optional trackers.
    }
    setAnalytics(nextAnalytics);
    setMarketing(nextMarketing);
    setOpen(false);
  };

  return open ? (
    <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/65 p-4" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-consent-title"
        aria-describedby="cookie-consent-description"
        className="my-auto w-full max-w-xl rounded-3xl border border-[#e8e2d6] bg-white p-5 text-[#21382d] shadow-2xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#e96d2c]">Privacy choices</p>
            <h2 id="cookie-consent-title" className="mt-2 text-2xl font-extrabold">Your privacy matters</h2>
          </div>
          {readPreferences() && (
            <button type="button" onClick={() => setOpen(false)} aria-label="Close cookie settings" className="rounded-lg p-2 hover:bg-[#f0ece2]">
              <X size={18}/>
            </button>
          )}
        </div>
        <p id="cookie-consent-description" className="mt-3 text-sm leading-6 text-[#59685f]">
          Essential browser storage keeps your basket, account session and security features working. Optional analytics and marketing trackers are currently not loaded. You can accept or reject optional categories without losing access to the menu or ordering.
        </p>
        <div className="mt-5 divide-y divide-[#ece7dc] rounded-2xl border border-[#e8e2d6]">
          <div className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="text-sm font-bold">Essential storage</p>
              <p className="mt-1 text-xs leading-5 text-[#69766e]">Basket, secure sign-in, security and saving this choice.</p>
            </div>
            <span className="shrink-0 text-xs font-bold text-[#315541]">Always active</span>
          </div>
          <label className="flex cursor-pointer items-center justify-between gap-4 p-4">
            <span><span className="block text-sm font-bold">Analytics</span><span className="mt-1 block text-xs leading-5 text-[#69766e]">Optional audience and site-use measurement. Not currently active.</span></span>
            <input type="checkbox" checked={analytics} onChange={event => setAnalytics(event.target.checked)} className="h-5 w-5 accent-[#315541]"/>
          </label>
          <label className="flex cursor-pointer items-center justify-between gap-4 p-4">
            <span><span className="block text-sm font-bold">Marketing</span><span className="mt-1 block text-xs leading-5 text-[#69766e]">Optional advertising and social-media tracking. Not currently active.</span></span>
            <input type="checkbox" checked={marketing} onChange={event => setMarketing(event.target.checked)} className="h-5 w-5 accent-[#315541]"/>
          </label>
        </div>
        <p className="mt-4 text-xs leading-5 text-[#69766e]">
          Damien's Smoky Kitchen is responsible for these choices. You can change or withdraw optional consent at any time using “Manage cookies” in the footer. Read the <a href="/cookies" className="font-semibold underline underline-offset-2">cookie notice</a> and <a href="/privacy" className="font-semibold underline underline-offset-2">privacy notice</a>.
        </p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => save(false, false)} className="rounded-xl border border-[#d9d4c9] px-4 py-3 text-sm font-bold hover:bg-[#f7f4ed]">Reject optional</button>
          <button type="button" onClick={() => save(true, true)} className="rounded-xl bg-[#21382d] px-4 py-3 text-sm font-bold text-white hover:bg-[#315541]">Accept all</button>
          <button type="button" onClick={() => save(analytics, marketing)} className="sm:col-span-2 rounded-xl bg-[#e96d2c] px-4 py-3 text-sm font-bold text-white hover:bg-[#d65b1d]">Save my preferences</button>
        </div>
      </section>
    </div>
  ) : null;
}

export function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}
