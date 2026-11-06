import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { Link, Route, Switch, useLocation } from 'wouter';
import { SignIn, SignUp, useAuth, useUser } from '@clerk/react';
import { ArrowRight, CheckCircle2, ChevronDown, Clock3, Flame, MapPin, MessageCircle, Minus, Plus, Search, Send, ShoppingBag, Trash2, Truck, Utensils, WifiOff, X } from 'lucide-react';
import { restaurantKnowledge, type MenuItem } from '@/chatbot/knowledge';
import menuImageMap from '@/chatbot/menu-image-map.json';
import { CookieConsent } from '@/components/CookieConsent';
import { CookiePolicyPage, PrivacyPolicyPage, TermsPage } from '@/pages/LegalPages';

type CatalogItem = MenuItem & { id: string; displayCategory: string; dietaryLabel?: 'Vegan' };
type BasketLine = { item: CatalogItem; quantity: number };
type ChatMessage = { role: 'user' | 'assistant'; content: string };
type MenuLoadStatus = 'loading' | 'ready' | 'fallback';

const displayCategory = (category: string) => category === 'Alcoholic Drinks' ? 'Alcoholic Drinks (18+)' : category.startsWith('Vegan ') ? category.slice('Vegan '.length) : category;
// The regular menu already contains the complete drinks list. Do not append drinksMenu again.
// Keep the original category in each item ID so saved baskets continue to resolve.
const catalog: CatalogItem[] = [...restaurantKnowledge.menu, ...restaurantKnowledge.veganMenu]
  .map((item) => ({
    ...item,
    id: `${item.category}:${item.name}:${item.price ?? 'ask'}`,
    displayCategory: displayCategory(item.category),
    dietaryLabel: item.category.startsWith('Vegan ') ? 'Vegan' as const : undefined,
  }));
const categories = Array.from(new Set(catalog.map((item) => item.displayCategory)));
const photoUrl = 'https://images.unsplash.com/photo-1638436684761-7e59f8a9072f?auto=format&fit=crop&fm=jpg&ixlib=rb-4.1.0&q=80&w=1600';

function money(value: number) {
  return '₦' + value.toLocaleString('en-NG');
}

function menuItemLabel(item: Pick<CatalogItem, 'name' | 'category' | 'price'>) {
  if (item.category === 'Rice' && item.name === 'Jollof Rice') return `Jollof Rice · ${item.price === 800 ? 'Small' : 'Large'}`;
  if (item.category === 'Rice' && item.name === 'Fried Rice') return `Fried Rice · ${item.price === 900 ? 'Small' : 'Large'}`;
  return item.name;
}

type MenuPhoto = {
  url: string;
  sourceUrl: string;
  author: string;
  license: string;
  licenseUrl: string;
  alt: string;
};

const menuPhotoFor = (item: CatalogItem): MenuPhoto | undefined =>
  (menuImageMap as Record<string, MenuPhoto>)[item.id];

const menuIllustration = (item: CatalogItem) => {
  // Keep a clearly labelled, unique fallback when no verified matching food photo is available.
  const escapeXml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char] ?? char);
  const palette = ['#e8d7b5', '#d8e3d1', '#f0d2c6', '#d9d8ed', '#e9e2b8', '#d1e3e8'];
  const hash = [...item.id].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 7);
  const background = palette[hash % palette.length];
  const initials = item.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const label = escapeXml(item.name.length > 25 ? `${item.name.slice(0, 22)}…` : item.name);
  const category = escapeXml(item.displayCategory.toUpperCase());
  const svg = `<svg data-menu-item="${escapeXml(item.id)}" xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600"><rect width="900" height="600" fill="${background}"/><circle cx="450" cy="255" r="155" fill="#fff" fill-opacity=".72"/><circle cx="450" cy="255" r="125" fill="none" stroke="#526a50" stroke-opacity=".3" stroke-width="8"/><text x="450" y="290" text-anchor="middle" font-family="Arial,sans-serif" font-size="112" font-weight="700" fill="#21382d">${initials}</text><text x="450" y="485" text-anchor="middle" font-family="Arial,sans-serif" font-size="34" font-weight="700" fill="#21382d">${label}</text><text x="450" y="535" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" letter-spacing="5" fill="#526a50">${category}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const menuVisual = (item: CatalogItem) => menuPhotoFor(item)?.url ?? menuIllustration(item);

const menuImageCredit = (item: CatalogItem) => {
  const photo = menuPhotoFor(item);
  if (!photo) return null;
  return <p className="mb-2 text-[10px] leading-4 text-[#71816f]">
    <span>Photo: </span>
    <a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">{photo.author}</a>
    <span> · </span>
    <a href={photo.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{photo.license}</a>
  </p>;
};


function App() {
  const [location, setLocation] = useLocation();
  const { isLoaded, isSignedIn, signOut, getToken } = useAuth();
  const { isLoaded: isUserLoaded, user } = useUser();
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeName, setWelcomeName] = useState("there");
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);

  useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  useEffect(() => {
    if (!isLoaded || (isSignedIn && !isUserLoaded)) return;
    if (!isSignedIn) {
      sessionStorage.removeItem("dsk-auth-welcome-shown");
      setShowWelcome(false);
      return;
    }
    if (sessionStorage.getItem("dsk-auth-welcome-shown") === "true") return;
    sessionStorage.setItem("dsk-auth-welcome-shown", "true");
    setWelcomeName(user?.firstName?.trim() || "there");
    setShowWelcome(true);
    const timeout = window.setTimeout(() => setShowWelcome(false), 2100);
    return () => window.clearTimeout(timeout);
  }, [isLoaded, isSignedIn, isUserLoaded, user?.firstName]);

  const [basket, setBasket] = useState<BasketLine[]>(() => {
    try {
      const saved = localStorage.getItem('damien-basket-v1');
      if (!saved) return [];
      const decoded = JSON.parse(saved) as Array<{ id: string; quantity: number }>;
      return decoded.flatMap(({ id, quantity }) => {
        const item = catalog.find((entry) => entry.id === id);
        return item && Number.isInteger(quantity) && quantity > 0 ? [{ item, quantity }] : [];
      });
    } catch {
      return [];
    }
  });

  const [menuItems, setMenuItems] = useState<CatalogItem[]>(catalog);
  const [menuLoadStatus, setMenuLoadStatus] = useState<MenuLoadStatus>('loading');
  useEffect(() => {
    let active = true;
    setMenuLoadStatus('loading');
    fetch("/api/menu", { cache:"no-store" })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("Menu unavailable")))
      .then(data => {
        if (!Array.isArray(data.items)) throw new Error("Menu response is invalid");
        if (!active) return;
        const items: CatalogItem[] = data.items.map((item: any) => ({
          ...item,
          displayCategory: item.displayCategory ?? displayCategory(item.category),
          dietaryLabel: item.dietaryLabel,
        }));
        setMenuItems(items);
        setMenuLoadStatus('ready');
        setBasket(current => current.flatMap(line => {
          const fresh = items.find(item => item.id === line.item.id);
          return fresh ? [{ ...line, item:fresh }] : [];
        }));
      })
      .catch(() => { if (active) setMenuLoadStatus('fallback'); /* Keep the bundled menu as an offline fallback. */ });
    return () => { active = false; };
  }, []);
  const [search, setSearch] = useState('');
  const [menuCategory, setMenuCategory] = useState('All');

  useEffect(() => {
    localStorage.setItem('damien-basket-v1', JSON.stringify(basket.map(({ item, quantity }) => ({ id: item.id, quantity }))));
  }, [basket]);

  const count = basket.reduce((total, line) => total + line.quantity, 0);
  const isStaffArea = location.startsWith("/staff") || location.startsWith("/admin");
  const add = (item: CatalogItem) => setBasket((current) => {
    const existing = current.find((line) => line.item.id === item.id);
    return existing
      ? current.map((line) => line.item.id === item.id ? { ...line, quantity: line.quantity + 1 } : line)
      : [...current, { item, quantity: 1 }];
  });
  const change = (id: string, delta: number) => setBasket((current) => current
    .map((line) => line.item.id === id ? { ...line, quantity: line.quantity + delta } : line)
    .filter((line) => line.quantity > 0));
  const remove = (id: string) => setBasket((current) => current.filter((line) => line.item.id !== id));
  const openMenu = (query = '') => {
    if (!isSignedIn) {
      setLocation('/menu');
      return;
    }
    if (menuItems.some(item => item.displayCategory === query)) {
      setMenuCategory(query);
      setSearch('');
    } else {
      setMenuCategory('All');
      setSearch(query);
    }
    setLocation('/menu');
  };
  const handleSignOut = async () => {
    await signOut();
    sessionStorage.removeItem("dsk-auth-welcome-shown");
    setLocation("/login");
  };

  if (!isOnline && !isLoaded) return <OfflinePage onRetry={() => window.location.reload()} />;
  if (!isLoaded) return <AppLoadingScreen />;
  // Staff has its own password + TOTP login. Marketing, help and legal pages are public.
  const isPublicLegalPage = ["/privacy", "/terms", "/cookies"].includes(location);
  const isPublicPage = location === "/" || location === "/delivery" || location === "/assistant" || isPublicLegalPage;
  if (!isStaffArea && !isPublicPage && !isSignedIn) {
    const redirectTo = ["/menu", "/checkout"].includes(location) ? location : "/";
    return <CustomerAuthPage mode={location === "/create-account" || location === "/menu" ? "register" : "login"} redirectTo={redirectTo} />;
  }

  return <div className="min-h-screen bg-[#fbf8f1] text-[#21382d]">
    {!isOnline && <div role="status" className="bg-[#fff0cf] px-4 py-2 text-center text-xs font-semibold text-[#6d5425]">You are offline. Previously loaded pages may remain available; sign-in and live services need an internet connection.</div>}
    {!isStaffArea && <header className="dsk-app-header sticky top-0 z-40 border-b border-[#e6e1d6] bg-[#fbf8f1]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Damien's Smoky Kitchen home">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e96d2c] text-white"><Flame size={21}/></span>
          <span className="hidden sm:block"><strong className="block text-sm leading-tight">Damien's</strong><span className="text-xs text-[#68786e]">Smoky Kitchen</span></span>
        </Link>
        <button onClick={() => setLocation('/delivery')} className="ml-1 hidden items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-[#f0ece2] md:flex">
          <MapPin size={17} className="text-[#e96d2c]"/><span><small className="block text-[10px] uppercase tracking-wide text-[#68786e]">Delivering to</small><strong className="text-xs">Lagos State</strong></span><ChevronDown size={14}/>
        </button>
        <form onSubmit={(event) => { event.preventDefault(); openMenu(search); }} className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-[#f0ece2] px-3 py-2.5">
          <Search size={18} className="shrink-0 text-[#68786e]"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search dishes and drinks" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#89948c]" aria-label="Search dishes and drinks"/><button className="hidden text-xs font-semibold text-[#e96d2c] sm:block">Search</button>
        </form>
        <nav aria-label="Main navigation" className="hidden items-center gap-3 lg:flex"><button type="button" onClick={() => openMenu()} className={location === '/menu' ? 'rounded-full bg-[#fff0cf] px-3 py-2 text-sm font-bold text-[#b64a1a]' : 'rounded-full px-3 py-2 text-sm font-bold text-[#526a50] hover:bg-[#fff0cf]'}>Menu</button><Link href="/delivery" className="rounded-full px-3 py-2 text-sm font-medium text-[#526a50] hover:bg-[#f0ece2]">Delivery</Link><button type="button" onClick={handleSignOut} className="px-2 py-2 text-sm font-semibold text-[#8a6254] hover:text-[#e96d2c]">Sign out</button></nav>
        <Link href="/checkout" className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#21382d] text-white hover:bg-[#315541]" aria-label={`Basket, ${count} items`}><ShoppingBag size={19}/>{count > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#e96d2c] px-1 text-[10px] font-bold">{count}</span>}</Link>
      </div>
      <nav aria-label="Mobile navigation" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-[#ece7dc] px-4 py-2.5 text-xs lg:hidden"><button type="button" onClick={() => openMenu()} className="rounded-full bg-[#fff0cf] px-3 py-2 font-bold text-[#b64a1a]">Menu</button><Link href="/delivery" className="rounded-full px-2 py-2 font-medium text-[#526a50]">Delivery</Link><button type="button" onClick={handleSignOut} className="px-2 py-2 font-semibold text-[#8a6254]">Sign out</button></nav>
    </header>}

    <Switch>
      <Route path="/"><Home onBrowse={openMenu} onOpenAssistant={() => setAssistantOpen(true)} menuItems={menuItems}/></Route>
      <Route path="/menu"><MenuPage search={search} setSearch={setSearch} add={add} basket={basket} activeCategory={menuCategory} setActiveCategory={setMenuCategory} menuItems={menuItems} menuLoadStatus={menuLoadStatus}/></Route>
      <Route path="/delivery"><DeliveryPage/></Route>
      <Route path="/assistant"><AssistantPage basket={basket}/></Route>
      <Route path="/checkout"><CheckoutPage basket={basket} change={change} remove={remove} clear={() => setBasket([])}/></Route>
      <Route path="/account"><LegacyAccountRedirect/></Route>
      <Route path="/create-account"><CustomerAuthPage mode="register"/></Route>
      <Route path="/login"><CustomerAuthPage mode="login"/></Route>
      <Route path="/staff/login"><StaffLoginPage/></Route>
      <Route path="/staff-login"><StaffLoginPage/></Route>
      <Route path="/staff"><StaffPortalPage/></Route>
      <Route path="/admin/dashboard"><StaffPortalPage/></Route>
      <Route path="/admin/menu"><AdminMenuPage/></Route>
      <Route path="/privacy"><PrivacyPolicyPage/></Route>
      <Route path="/terms"><TermsPage/></Route>
      <Route path="/cookies"><CookiePolicyPage/></Route>
      <Route><NotFound/></Route>
    </Switch>

    {!isStaffArea && <footer className="dsk-app-footer mt-16 bg-[#21382d] text-white"><div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:grid-cols-3 sm:px-6"><div><div className="flex items-center gap-2 font-bold"><Flame size={18} className="text-[#f29a53}"/> Damien's Smoky Kitchen</div><p className="mt-3 max-w-xs text-sm leading-6 text-white/70">Nigerian rice, soups, grills and small chops, prepared from our Ibafo kitchen.</p></div><div><p className="text-sm font-semibold">Kitchen address and hours</p><p className="mt-3 text-sm leading-6 text-white/70">The Motorcycle Drive, Papa Olonrisa<br/>Ibafo, Ogun State<br/>Daily, 9:00 AM–9:00 PM</p></div><div><p className="text-sm font-semibold">Delivery coverage</p><p className="mt-3 text-sm leading-6 text-white/70">Lagos State delivery only<br/>Minimum delivery order: ₦3,000<br/>Fee depends on distance</p></div></div><div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-white/15 px-5 py-4 text-xs text-white/65"><span>© {new Date().getFullYear()} Damien's Smoky Kitchen</span><Link href="/privacy" className="underline underline-offset-4">Privacy</Link><Link href="/terms" className="underline underline-offset-4">Terms</Link><Link href="/cookies" className="underline underline-offset-4">Cookie notice</Link><button type="button" onClick={() => window.dispatchEvent(new Event("dsk:open-cookie-settings"))} className="underline underline-offset-4">Manage cookies</button></div></footer>}
    {!isStaffArea && <CookieConsent/>}
    {!isStaffArea && <KitchenAssistantWidget basket={basket} open={assistantOpen} onOpenChange={setAssistantOpen} getToken={getToken}/>}
    {showWelcome && !isStaffArea && <WelcomeOverlay name={welcomeName}/>}
  </div>;
}

function AppLoadingScreen() {
  return <main role="status" aria-live="polite" aria-busy="true" className="min-h-screen bg-[#f7f8f4] px-5 py-10 text-[#21382d] sm:px-8">
    <div className="mx-auto w-full max-w-5xl">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#21382d] text-white"><Flame size={23}/></span>
        <div><p className="text-sm font-extrabold">Damien's Smoky Kitchen</p><p className="text-xs text-[#69766e]">Fresh Nigerian favourites</p></div>
      </div>
      <section className="mt-8 overflow-hidden rounded-[2rem] border border-[#eee8dc] bg-white p-5 shadow-sm sm:p-8">
        <div className="grid gap-6 md:grid-cols-2 md:items-center">
          <div className="space-y-4">
            <div className="h-3 w-28 animate-pulse rounded-full bg-[#f0ece2]"/>
            <div className="h-9 w-full max-w-sm animate-pulse rounded-xl bg-[#eee8dc]"/>
            <div className="h-4 w-full max-w-md animate-pulse rounded-full bg-[#f0ece2]"/>
            <div className="h-4 w-4/5 animate-pulse rounded-full bg-[#f0ece2]"/>
            <div className="mt-5 h-11 w-36 animate-pulse rounded-full bg-[#e8eee6]"/>
          </div>
          <div className="h-44 animate-pulse rounded-2xl bg-[#f0ece2] sm:h-56"/>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <div key={index} className="rounded-2xl border border-[#eee8dc] p-3">
            <div className="h-20 animate-pulse rounded-xl bg-[#f0ece2]"/>
            <div className="mt-3 h-3 w-3/4 animate-pulse rounded-full bg-[#eee8dc]"/>
            <div className="mt-2 h-3 w-1/2 animate-pulse rounded-full bg-[#f0ece2]"/>
          </div>)}
        </div>
        <p className="mt-7 text-center text-sm text-[#69766e]">Getting the kitchen ready and checking your secure session…</p>
        <div className="mx-auto mt-3 h-1.5 w-36 overflow-hidden rounded-full bg-[#eee8dc]"><span className="dsk-loading-bar block h-full rounded-full bg-[#e96d2c]"/></div>
      </section>
    </div>
  </main>;
}

function LegacyAccountRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/");
  }, [setLocation]);
  return <AppLoadingScreen/>;
}

function WelcomeOverlay({ name }: { name: string }) {
  return <div className="dsk-welcome-overlay" role="status" aria-live="polite">
    <div className="dsk-welcome-card">
      <span className="dsk-welcome-check"><CheckCircle2 size={44} strokeWidth={1.8}/></span>
      <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-[#f3b17f]">Sign-in successful</p>
      <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-white">Welcome, {name}!</h2>
      <p className="mt-2 text-sm text-white/70">You're securely signed in. Your kitchen is ready.</p>
    </div>
  </div>;
}

function OfflinePage({ onRetry }: { onRetry: () => void }) {
  return <main className="flex min-h-screen items-center justify-center bg-[#f7f8f4] px-5 py-12 text-center">
    <section className="dsk-offline-card w-full max-w-md rounded-[2rem] border border-[#e7e9e2] bg-white p-8 shadow-xl sm:p-10">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#fff0e5] text-[#c35b2b]"><WifiOff size={28}/></span>
      <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-[#e96d2c]">Connection interrupted</p>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#21382d]">The kitchen can't reach you.</h1>
      <p className="mt-3 text-sm leading-6 text-[#69766e]">It looks like your internet connection is offline. Check your network and try again. Your account and basket have not been cleared.</p>
      <button onClick={onRetry} className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-[#21382d] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#315541]">Try again <ArrowRight size={16}/></button>
    </section>
  </main>;
}

function Home({ onBrowse, onOpenAssistant, menuItems }: { onBrowse: (query?: string) => void; onOpenAssistant: () => void; menuItems: CatalogItem[] }) {
  const quickCategories = Array.from(new Set(menuItems.map(item => item.displayCategory)));
  const featured = menuItems.filter((item, index, items) => {
    const photo = menuPhotoFor(item);
    return Boolean(photo) && items.findIndex((candidate) => menuPhotoFor(candidate)?.url === photo?.url) === index;
  }).slice(0, 4);
  return <main className="bg-[#f7f8f4]">
    <section className="mx-auto max-w-7xl px-4 pb-5 pt-5 sm:px-6">
      <div className="overflow-hidden rounded-[2rem] bg-[#ffc94a]">
        <div className="flex flex-col items-stretch lg:min-h-[252px] lg:flex-row">
          <div className="flex min-w-0 flex-1 flex-col justify-center p-5 sm:p-7 lg:p-6">
            <span className="w-fit rounded-full bg-white/70 px-3 py-1.5 text-xs font-bold text-[#26372c]">DAMIEN'S SMOKY KITCHEN · IBAFO</span>
            <h1 className="mt-2 max-w-xl text-3xl font-extrabold leading-[1.02] tracking-tight text-[#202a23] sm:mt-3 sm:text-4xl">Nigerian favourites, made fresh in Ibafo.</h1>
            <p className="mt-2 max-w-md text-sm leading-5 text-[#39463b] sm:mt-2 sm:text-sm sm:leading-6">From smoky rice and hearty soups to grilled favourites and small chops, prepared daily from 9 AM to 9 PM.</p>
            <div className="mt-3 flex flex-wrap gap-2 sm:mt-4">
              <button onClick={() => onBrowse()} className="inline-flex items-center gap-2 rounded-full bg-[#26372c] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#3c5543]">Explore the menu <ArrowRight size={17}/></button>
              <Link href="/delivery" className="inline-flex items-center gap-2 rounded-full border border-[#26372c]/25 bg-white/55 px-5 py-2.5 text-sm font-bold text-[#26372c] hover:bg-white/80">Delivery information</Link>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] font-semibold text-[#39463b] sm:mt-3"><span className="inline-flex items-center gap-1.5"><Clock3 size={14}/> Daily, 9 AM–9 PM</span><span className="inline-flex items-center gap-1.5"><Truck size={14}/> Delivery across Lagos State</span><span className="inline-flex items-center gap-1.5"><MapPin size={14}/> Kitchen in Ibafo, Ogun State</span></div>
          </div>
          <div className="relative min-h-[160px] flex-1 sm:min-h-[180px] lg:min-h-[252px]">
            <img src={photoUrl} alt="Freshly prepared Nigerian food served at a table" className="absolute inset-0 h-full w-full object-cover"/>
            <div className="absolute inset-0 bg-gradient-to-t from-[#172c21]/25 to-transparent"/>
            <div className="absolute bottom-5 left-5 rounded-2xl bg-white/95 px-4 py-3 shadow-lg backdrop-blur-sm sm:bottom-7 sm:left-7"><p className="text-[10px] font-bold uppercase tracking-widest text-[#68786e]">Made with care</p><p className="mt-1 text-sm font-extrabold text-[#26372c]">Cooked fresh in Ibafo. Delivered across Lagos.</p></div>
          </div>
        </div>
      </div>
    </section>
    <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
      <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-[#71816f]">What are you craving?</p><h2 className="mt-1 text-2xl font-extrabold tracking-tight text-[#26372c] sm:text-3xl">Explore categories</h2></div><button type="button" onClick={() => onBrowse()} className="text-sm font-bold text-[#526a50] hover:underline">View all</button></div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{quickCategories.map((category) => { const categoryPhoto = menuItems.find((item) => item.displayCategory === category && menuPhotoFor(item)); const photo = categoryPhoto ? menuPhotoFor(categoryPhoto) : undefined; return <button key={category} onClick={() => onBrowse(category)} className="group overflow-hidden rounded-2xl border border-[#e7e9e2] bg-white text-left transition hover:-translate-y-1 hover:border-[#ffc94a] hover:shadow-md"><span className="relative block aspect-[16/9] overflow-hidden bg-[#f0ece2]">{photo ? <img src={photo.url} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105"/> : <span className="grid h-full w-full place-items-center text-[#526a50]"><Utensils size={24}/></span>}<span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-3 pb-2 pt-7 text-sm font-bold text-white">{category}</span></span><span className="block px-3 py-2 text-[11px] text-[#7a857b]">Explore dishes</span></button>; })}</div>
    </section>
    <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
      <div><p className="text-xs font-bold uppercase tracking-widest text-[#71816f]">A taste of the kitchen</p><h2 className="mt-1 text-2xl font-extrabold tracking-tight text-[#26372c] sm:text-3xl">A few customer favourites</h2><p className="mt-1 text-sm text-[#7a857b]">Explore the menu after creating your customer account.</p></div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{featured.map((item) => { const photo = menuPhotoFor(item); return <button key={item.id} type="button" onClick={() => onBrowse(item.displayCategory)} className="group overflow-hidden rounded-2xl border border-[#e7e9e2] bg-white text-left transition hover:-translate-y-1 hover:border-[#ffc94a] hover:shadow-md"><span className="block aspect-[4/3] overflow-hidden bg-[#f0ece2]"><img src={photo!.url} alt={photo!.alt || menuItemLabel(item)} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105"/></span><span className="block px-3 py-3"><span className="block text-sm font-bold text-[#26372c]">{menuItemLabel(item)}</span><span className="mt-1 block text-[11px] text-[#7a857b]">Explore dish</span></span></button>; })}</div>
    </section>
    <section className="mx-auto max-w-7xl px-4 pb-10 pt-5 sm:px-6"><div className="grid gap-4 md:grid-cols-2"><Link href="/delivery" className="flex items-center justify-between gap-4 rounded-3xl bg-[#e8eee6] p-6 transition hover:bg-[#dfe8dc]"><div><span className="text-xs font-bold uppercase tracking-widest text-[#71816f]">At your door</span><h2 className="mt-2 text-xl font-extrabold text-[#26372c]">Delivery across Lagos</h2><p className="mt-1 text-sm text-[#596b5d]">₦3,000 minimum order · Fee depends on distance</p></div><Truck size={30} className="shrink-0 text-[#526a50]"/></Link><button type="button" onClick={onOpenAssistant} className="flex w-full items-center justify-between gap-4 rounded-3xl bg-[#fff0cf] p-6 text-left transition hover:bg-[#ffe7ad]"><div><span className="text-xs font-bold uppercase tracking-widest text-[#8a6c36]">Need a recommendation?</span><h2 className="mt-2 text-xl font-extrabold text-[#26372c]">Ask the kitchen</h2><p className="mt-1 text-sm text-[#756347]">Get help with menu and restaurant questions</p></div><MessageCircle size={30} className="shrink-0 text-[#8a6c36]"/></button></div></section>
  </main>;
}

function ProductCard({ item, onAdd }: { item: CatalogItem; onAdd: () => void }) {
  return <article className="group overflow-hidden rounded-3xl border border-[#e7e9e2] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
    <div className="relative h-40 overflow-hidden bg-[#f0f1eb]"><img src={menuVisual(item)} alt={menuPhotoFor(item)?.alt ?? `${menuItemLabel(item)} menu illustration`} loading="lazy" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = menuIllustration(item); }} className="h-full w-full object-cover transition duration-500 group-hover:scale-105"/><span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#526a50]">{item.displayCategory}</span></div>
    <div className="p-4">{menuImageCredit(item)}<h3 className="min-h-10 font-bold leading-snug text-[#29382d]">{menuItemLabel(item)}</h3><div className="mt-4 flex items-center justify-between gap-3"><strong className="text-base text-[#26372c]">{item.price === null ? 'Ask for price' : money(item.price)}</strong>{item.price !== null && <button onClick={onAdd} aria-label={`Add ${menuItemLabel(item)} to basket`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#ffc94a] text-[#26372c] transition hover:bg-[#f4b923]"><Plus size={19}/></button>}</div></div>
  </article>;
}

function MenuMotionFeature() {
  const containerRef = useRef<HTMLElement>(null);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const target = containerRef.current;
    if (!target) return;
    if (!('IntersectionObserver' in window)) {
      setShouldLoadVideo(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setShouldLoadVideo(true);
        observer.disconnect();
      }
    }, { rootMargin: '240px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return <section ref={containerRef} aria-label="Fresh from the grill" className="dsk-menu-motion relative isolate mt-7 min-h-[245px] overflow-hidden rounded-[1.75rem] bg-[#21382d] sm:min-h-[275px]">
    <img src={photoUrl} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover md:object-[center_48%]"/>
    {shouldLoadVideo && <video
      className="dsk-menu-motion__video absolute inset-0 h-full w-full object-cover"
      src="https://videos.pexels.com/video-files/856399/856399-hd_1920_1080_25fps.mp4"
      poster={photoUrl}
      autoPlay
      muted
      loop
      playsInline
      preload="none"
      disablePictureInPicture
      aria-hidden="true"
      tabIndex={-1}
    />}
    <div className="absolute inset-0 bg-gradient-to-r from-[#172c21] via-[#172c21]/90 to-[#172c21]/15 md:via-[#172c21]/80 md:to-[#172c21]/5"/>
    <div className="dsk-menu-motion__copy relative z-10 flex min-h-[245px] max-w-2xl flex-col justify-center p-6 sm:min-h-[275px] sm:p-9">
      <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#ffc94a]/35 bg-[#21382d]/65 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#ffc94a] backdrop-blur-sm">
        <Flame size={13}/> Fresh from our kitchen
      </span>
      <h2 className="mt-4 max-w-lg text-3xl font-extrabold leading-[1.04] tracking-tight text-white sm:text-4xl">Fresh from the flame.</h2>
      <p className="mt-3 max-w-md text-sm leading-6 text-white/80 sm:text-base">Real ingredients. Proper heat. Nigerian favourites made fresh with care.</p>
      <span className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-white/90"><span className="h-1.5 w-1.5 rounded-full bg-[#e96d2c]"/> Made fresh, served with care</span>
    </div>
  </section>;
}

function MenuPage({ search, setSearch, add, basket, activeCategory, setActiveCategory, menuItems, menuLoadStatus }: { search: string; setSearch: (value: string) => void; add: (item: CatalogItem) => void; basket: BasketLine[]; activeCategory: string; setActiveCategory: (value: string) => void; menuItems: CatalogItem[]; menuLoadStatus: MenuLoadStatus }) {
  const active = activeCategory;
  const setActive = setActiveCategory;
  const categories = Array.from(new Set(menuItems.map(item => item.displayCategory)));
  const categoriesWithAll = ['All', ...categories];
  const filtered = menuItems.filter((item) => (active === 'All' || item.displayCategory === active) && `${item.name} ${item.displayCategory} ${item.dietaryLabel ?? ''}`.toLowerCase().includes(search.toLowerCase()));
  const displayedGroups = active === 'All'
    ? categories.map((category) => ({ category, items: filtered.filter((item) => item.displayCategory === category) })).filter((group) => group.items.length > 0)
    : [{ category: active, items: filtered }];
  const basketCount = basket.reduce((sum, line) => sum + line.quantity, 0);
  return <main className="mx-auto max-w-7xl bg-[#f7f8f4] px-4 pt-8 pb-32 sm:px-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-widest text-[#71816f]">Damien's Smoky Kitchen</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#26372c] sm:text-4xl">Explore the menu</h1><p className="mt-2 text-sm text-[#69766e]">Browse every dish, see the price and add your favourites to your basket.</p></div>
      <div className="rounded-2xl bg-[#fff0cf] px-4 py-3 text-xs font-semibold text-[#39463b]">Minimum delivery order <strong className="ml-1">₦3,000</strong></div>
    </div>
    <MenuMotionFeature/>
    <div className="sticky top-[72px] z-20 -mx-4 mt-6 border-y border-[#e7e9e2] bg-[#f7f8f4]/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
      <div className="flex gap-2 overflow-x-auto pb-1">{categoriesWithAll.map((category) => <button key={category} onClick={() => setActive(category)} className={active === category ? 'shrink-0 rounded-full bg-[#26372c] px-4 py-2.5 text-xs font-bold text-white' : 'shrink-0 rounded-full border border-[#dfe4dc] bg-white px-4 py-2.5 text-xs font-semibold text-[#526a50] transition hover:border-[#ffc94a]'}>{category}</button>)}</div>
    </div>
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold text-[#526a50]">{filtered.length} menu items</p><p className="text-xs text-[#7a857b]">Prices in Nigerian naira</p></div>{menuLoadStatus === "loading" && <p role="status" aria-live="polite" className="mt-3 rounded-xl bg-[#eef2eb] px-4 py-3 text-xs text-[#526a50]">Showing the saved menu while checking for the latest updates…</p>}{menuLoadStatus === "fallback" && <p role="status" aria-live="polite" className="mt-3 rounded-xl bg-[#fff0cf] px-4 py-3 text-xs text-[#80552e]">The live menu could not be reached. You can still browse the saved menu; prices and availability may need confirmation.</p>}
    <div className="mt-4 space-y-10">{displayedGroups.map((group) => <section key={group.category} aria-labelledby={`menu-group-${group.category.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`}><div className="mb-4 flex items-center justify-between gap-3"><h2 id={`menu-group-${group.category.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`} className="text-xl font-extrabold tracking-tight text-[#26372c]">{group.category}</h2><span className="text-xs font-semibold text-[#7a857b]">{group.items.length} items</span></div>{group.category === 'Alcoholic Drinks (18+)' && <p role="note" className="mb-4 rounded-xl border border-[#ead8b8] bg-[#fff8ed] px-4 py-3 text-xs leading-5 text-[#76542f]">18+ only. Alcoholic drinks are not sold to anyone under 18. Valid proof of age may be requested. Please drink responsibly.</p>}<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{group.items.map((item) => <article key={item.id} className="group overflow-hidden rounded-3xl border border-[#e7e9e2] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div className="relative h-44 overflow-hidden bg-[#eef0e9]"><img src={menuVisual(item)} alt={menuPhotoFor(item)?.alt ?? `${menuItemLabel(item)} menu illustration`} loading="lazy" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = menuIllustration(item); }} className="h-full w-full object-cover transition duration-500 group-hover:scale-105"/><div className="absolute left-3 top-3 flex gap-2"><span className="rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#526a50]">{item.displayCategory}</span>{item.dietaryLabel && <span className="rounded-full bg-[#e8eee6]/95 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#526a50]">Vegan</span>}</div></div>
      <div className="p-4">{menuImageCredit(item)}<h3 className="min-h-10 font-bold leading-snug text-[#29382d]">{menuItemLabel(item)}</h3><div className="mt-4 flex items-center justify-between gap-3"><strong className="text-base text-[#26372c]">{item.price === null ? 'Ask for price' : money(item.price)}</strong>{item.price !== null && <button onClick={() => add(item)} aria-label={`Add ${menuItemLabel(item)} to basket`} className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#ffc94a] px-4 py-2.5 text-xs font-bold text-[#26372c] transition hover:bg-[#f4b923]"><Plus size={15}/> Add</button>}</div></div>
    </article>)}</div></section>)}</div>
    {filtered.length === 0 && <p className="rounded-2xl bg-white p-8 text-center text-sm text-[#69766e]">No menu items match that search.</p>}
    <aside className="dsk-basket-bar fixed left-1/2 z-30 flex w-[min(92vw,560px)] -translate-x-1/2 items-center justify-between gap-3 rounded-2xl bg-[#26372c] px-4 py-3 text-white shadow-xl" aria-live="polite"><span className="text-sm font-semibold">{basketCount} items in basket</span><Link href="/checkout" aria-label={`Review basket with ${basketCount} items`} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#ffc94a] px-4 py-2.5 text-sm font-bold text-[#26372c]">Review basket <ArrowRight size={16}/></Link></aside>
  </main>;
}

function DeliveryPage() {
  return <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6"><p className="text-xs font-bold uppercase tracking-widest text-[#e96d2c]">Good to know</p><h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Delivery information</h1><div className="mt-8 grid gap-4 sm:grid-cols-2"><InfoCard icon={<MapPin/>} title="Delivery coverage">Our kitchen is in Ibafo, Ogun State. Delivery is available across Lagos State only.</InfoCard><InfoCard icon={<ShoppingBag/>} title="Minimum order">The minimum delivery order is ₦3,000.</InfoCard><InfoCard icon={<Truck/>} title="Delivery fee">The fee depends on the delivery distance. The exact fee is not calculated on this site.</InfoCard><InfoCard icon={<Clock3/>} title="Opening hours">Daily, 9:00 AM–9:00 PM.</InfoCard></div><section className="mt-8 rounded-3xl bg-[#21382d] p-6 text-white sm:p-8"><h2 className="text-xl font-bold">Restaurant location</h2><p className="mt-3 text-sm leading-6 text-white/75">The Motorcycle Drive, Papa Olonrisa, Ibafo, Ogun State.</p><p className="mt-5 text-sm text-white/75">Add your items to the basket to review them. Delivery availability and distance-based fees must be confirmed before an order is completed.</p><Link href="/menu" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#e96d2c] px-4 py-3 text-sm font-bold">Browse menu <ArrowRight size={16}/></Link></section></main>;
}

function InfoCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return <article className="rounded-2xl border border-[#e8e2d6] bg-white p-5"><span className="text-[#e96d2c]">{icon}</span><h2 className="mt-3 font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-[#69766e]">{children}</p></article>;
}

function AssistantPage({ basket }: { basket: BasketLine[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', content: 'Káàbọ̀! I can help you explore the menu, check prices, understand delivery and find something you will enjoy.' }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const quickQuestions = ['Show me the Jollof menu', "What's in my basket?", 'What time do you close?', 'Where do you deliver?', 'Do you have vegan options?'];

  const ask = async (rawQuestion: string) => {
    const question = rawQuestion.trim();
    if (!question || busy) return;
    const next = [...messages, { role: 'user' as const, content: question }];
    setMessages(next);
    setInput('');

    if (/\b(basket|cart)\b/i.test(question)) {
      const answer = basket.length
        ? `Your basket currently has ${basket.reduce((total, line) => total + line.quantity, 0)} item(s):\n\n${basket.map(({ item, quantity }) => `• ${quantity} × ${menuItemLabel(item)} (${item.price === null ? 'price to confirm' : money(item.price * quantity)})`).join('\n')}\n\nSubtotal: ${money(basket.reduce((total, line) => total + (line.item.price ?? 0) * line.quantity, 0))}. Delivery is calculated separately.`
        : 'Your basket is empty at the moment. You can browse the menu and add any dishes you would like to order.';
      setMessages([...next, { role: 'assistant', content: answer }]);
      return;
    }

    setBusy(true);
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: next.slice(-12) }) });
      const body = await response.text();
      if (!response.ok) {
        let message = 'The kitchen assistant is unavailable right now.';
        try { message = JSON.parse(body).error ?? message; } catch { /* keep the safe message */ }
        throw new Error(message);
      }
      setMessages((current) => [...current, { role: 'assistant', content: body }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The kitchen assistant is unavailable right now.';
      setMessages((current) => [...current, { role: 'assistant', content: message }]);
    } finally {
      setBusy(false);
    }
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    await ask(input);
  };

  return <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[.8fr_1.2fr]">
    <section>
      <p className="text-xs font-bold uppercase tracking-widest text-[#e96d2c]">Kitchen assistant</p>
      <h1 className="mt-2 text-3xl font-extrabold">Ask about the food.</h1>
      <p className="mt-4 text-sm leading-6 text-[#69766e]">I can help with dishes, prices, your basket, opening hours and delivery. Answers use the restaurant's information, so I will say when a detail needs confirmation.</p>
      <div className="mt-6 rounded-2xl bg-[#e8eee6] p-5 text-sm leading-6">
        <strong>Try asking</strong>
        <div className="mt-3 flex flex-wrap gap-2">
          {quickQuestions.map((text) => <button key={text} type="button" disabled={busy} onClick={() => void ask(text)} className="rounded-full border border-[#cbd8cd] bg-white px-3 py-2 text-xs transition hover:border-[#e96d2c] hover:bg-[#fffaf0] disabled:opacity-50">{text}</button>)}
        </div>
      </div>
    </section>
    <section className="flex min-h-[540px] flex-col overflow-hidden rounded-3xl border border-[#e8e2d6] bg-white shadow-sm">
      <header className="flex items-center gap-3 border-b border-[#eee9df] p-4">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#21382d] text-white"><Flame size={19}/></span>
        <span><strong className="block text-sm">Damien's kitchen</strong><small className="text-xs text-[#69766e]">Menu and restaurant help</small></span>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto bg-[#fbf8f1] p-4" aria-live="polite">
        {messages.map((message, index) => <div key={index} className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}><p className={message.role === 'user' ? 'max-w-[85%] whitespace-pre-line rounded-2xl rounded-br-sm bg-[#21382d] px-4 py-3 text-sm leading-6 text-white' : 'max-w-[85%] whitespace-pre-line rounded-2xl rounded-bl-sm border border-[#e8e2d6] bg-white px-4 py-3 text-sm leading-6'}>{message.content}</p></div>)}
        {busy && <p className="text-xs text-[#69766e]" role="status">Checking the kitchen information…</p>}
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-[#eee9df] p-3">
        <input value={input} maxLength={2000} onChange={(event) => setInput(event.target.value)} placeholder="Ask about dishes, prices or delivery" className="min-w-0 flex-1 rounded-xl bg-[#f0ece2] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#e96d2c]"/>
        <button disabled={busy || !input.trim()} className="rounded-xl bg-[#e96d2c] px-4 text-white disabled:opacity-50" aria-label="Send question"><ArrowRight size={18}/></button>
      </form>
    </section>
  </main>;
}

function CheckoutPage({ basket, change, remove, clear }: { basket: BasketLine[]; change: (id: string, delta: number) => void; remove: (id: string) => void; clear: () => void }) {
  const subtotal = basket.reduce((sum, line) => sum + (line.item.price ?? 0) * line.quantity, 0);
  const meetsMinimum = subtotal >= restaurantKnowledge.minimumDeliveryOrder;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [stateName, setStateName] = useState('Lagos');
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [ordersEnabled, setOrdersEnabled] = useState(false);
  const [orderStatusLoading, setOrderStatusLoading] = useState(true);
  const [orderStatusError, setOrderStatusError] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [confirmation, setConfirmation] = useState<{ orderId: string; message: string } | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/orders/status', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : Promise.reject(new Error('Checkout status unavailable')))
      .then(result => { if (active) setOrdersEnabled(result.enabled === true); })
      .catch(() => { if (active) { setOrdersEnabled(false); setOrderStatusError(true); } })
      .finally(() => { if (active) setOrderStatusLoading(false); });
    return () => { active = false; };
  }, []);

  const submitOrder = async (event: FormEvent) => {
    event.preventDefault();
    if (!basket.length || busy || !ordersEnabled) return;
    setBusy(true); setStatus('');
    try {
      const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey }, body: JSON.stringify({ name, phone, address, state: stateName, adultConfirmed, items: basket.map(({ item, quantity }) => ({ name: item.name, category: item.category, quantity })) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Could not save this order.');
      setConfirmation({ orderId: result.orderId, message: result.message });
      clear();
      setIdempotencyKey(crypto.randomUUID());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save this order.');
    } finally { setBusy(false); }
  };

  if (confirmation) return <main className="mx-auto max-w-3xl px-4 py-20 text-center"><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#e8eee6] text-[#315541]"><ShoppingBag size={25}/></span><h1 className="mt-5 text-3xl font-extrabold">Order request saved</h1><p className="mt-3 text-sm leading-6 text-[#69766e]">{confirmation.message}</p><p className="mt-3 text-xs text-[#69766e]">Reference: <strong>{confirmation.orderId}</strong></p><Link href="/menu" className="mt-6 inline-flex rounded-xl bg-[#e96d2c] px-5 py-3 text-sm font-bold text-white">Continue browsing</Link></main>;
  if (!basket.length) return <main className="mx-auto max-w-3xl px-4 py-20 text-center"><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#e8eee6] text-[#315541]"><ShoppingBag size={25}/></span><h1 className="mt-5 text-3xl font-extrabold">Your basket is empty</h1><p className="mt-2 text-sm text-[#69766e]">Browse the menu and add dishes to start an order review.</p><Link href="/menu" className="mt-6 inline-flex rounded-xl bg-[#e96d2c] px-5 py-3 text-sm font-bold text-white">Browse menu</Link></main>;

  return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
    <div><p className="text-xs font-bold uppercase tracking-widest text-[#e96d2c]">Your basket</p><h1 className="mt-2 text-3xl font-extrabold">Review your order</h1><p className="mt-2 text-sm text-[#69766e]">Review the dishes and subtotal. Live order submission will be enabled after secure customer-data processing is ready. No payment is taken online.</p></div>
    <div className="mt-7 grid gap-8 lg:grid-cols-[1.1fr_.9fr]">
      <section className="space-y-3">
        {basket.map(({ item, quantity }) => <article key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[#e8e2d6] bg-white p-4"><div><h2 className="font-bold">{menuItemLabel(item)}</h2><p className="mt-1 text-xs text-[#69766e]">{item.category} · {money(item.price ?? 0)} each</p></div><div className="flex items-center gap-2"><button onClick={() => change(item.id, -1)} className="grid h-8 w-8 place-items-center rounded-lg border" aria-label={`Remove one ${menuItemLabel(item)}`}><Minus size={14}/></button><span className="w-5 text-center text-sm font-semibold">{quantity}</span><button onClick={() => change(item.id, 1)} className="grid h-8 w-8 place-items-center rounded-lg border" aria-label={`Add one ${menuItemLabel(item)}`}><Plus size={14}/></button><button onClick={() => remove(item.id)} className="ml-1 text-[#8a6254]" aria-label={`Remove ${menuItemLabel(item)}`}><Trash2 size={16}/></button></div></article>)}
        <button onClick={clear} className="text-xs font-semibold text-[#8a6254]">Clear basket</button>
        <div className="rounded-2xl bg-[#e8eee6] p-4 text-sm"><strong>Delivery fee:</strong> depends on distance and is not included in this subtotal. The restaurant must confirm it.</div>
      </section>
      <section className="rounded-3xl border border-[#e8e2d6] bg-white p-5 sm:p-7">
        <div className="flex justify-between border-b border-[#eee9df] pb-4"><span className="text-sm">Food subtotal</span><strong>{money(subtotal)}</strong></div>
        <p className="py-4 text-xs leading-5 text-[#69766e]">Minimum delivery order: {money(restaurantKnowledge.minimumDeliveryOrder)}. Delivery is limited to Lagos State.</p>
        {!meetsMinimum && <p className="mb-4 rounded-xl bg-[#fff0e5] p-3 text-xs text-[#8b401d]">Add {money(restaurantKnowledge.minimumDeliveryOrder - subtotal)} more to meet the delivery minimum.</p>}
        {orderStatusLoading ? <p className="rounded-xl bg-[#e8eee6] p-4 text-xs leading-5 text-[#52645a]" role="status">Checking secure checkout availability…</p> : orderStatusError ? <div className="rounded-xl bg-[#fff0e5] p-4 text-sm leading-6 text-[#8b401d]" role="alert"><strong className="block text-[#21382d]">We could not check checkout availability.</strong><p className="mt-2">Your basket is safe. Check your connection and reload this page before trying again.</p></div> : !ordersEnabled ? <div className="rounded-xl bg-[#e8eee6] p-4 text-sm leading-6 text-[#52645a]"><strong className="block text-[#21382d]">Online ordering is temporarily unavailable.</strong><p className="mt-2">We are completing the data-protection and secure order-processing setup. Your name, phone number and delivery address are not being requested or submitted here. You can still browse the menu.</p></div> : <form onSubmit={submitOrder} className="space-y-3">
          <label className="block text-xs font-semibold">Your name<input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-xl bg-[#f0ece2] px-3 py-3 text-sm font-normal outline-none focus:ring-2 focus:ring-[#e96d2c]"/></label>
          <label className="block text-xs font-semibold">Phone number<input required maxLength={24} value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1 w-full rounded-xl bg-[#f0ece2] px-3 py-3 text-sm font-normal outline-none focus:ring-2 focus:ring-[#e96d2c]"/></label>
          <label className="block text-xs font-semibold">Delivery address in Lagos<input required maxLength={300} value={address} onChange={(event) => setAddress(event.target.value)} className="mt-1 w-full rounded-xl bg-[#f0ece2] px-3 py-3 text-sm font-normal outline-none focus:ring-2 focus:ring-[#e96d2c]"/></label>
          <label className="flex items-start gap-2 text-xs leading-5 text-[#69766e]"><input type="checkbox" required checked={adultConfirmed} onChange={event => setAdultConfirmed(event.target.checked)} className="mt-1 accent-[#e96d2c]"/>I confirm I am 18 or older. If I am ordering for a child, I am the parent/legal guardian and I am providing my own contact and delivery details.</label>
          <p className="text-xs leading-5 text-[#69766e]">We use these details to process your order request and arrange delivery. Read our <Link href="/privacy" className="font-semibold underline">Privacy Notice</Link> and <Link href="/terms" className="font-semibold underline">Ordering Terms</Link>.</p>
          <button disabled={busy || !meetsMinimum} className="w-full rounded-xl bg-[#21382d] px-4 py-3.5 text-sm font-bold text-white hover:bg-[#315541] disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Saving order…' : 'Send order request'}</button>
          {status && <p role="status" className="rounded-xl bg-[#e8eee6] p-3 text-xs leading-5">{status}</p>}
        </form>}
      </section>
    </div>
  </main>;
}

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <main className="mx-auto max-w-md px-4 py-12 sm:py-16"><section className="rounded-3xl border border-[#e8e2d6] bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#e96d2c]">Damien's Smoky Kitchen</p><h1 className="mt-3 text-3xl font-extrabold">{title}</h1><p className="mt-2 text-sm leading-6 text-[#69766e]">{subtitle}</p>{children}</section></main>;
}

function CustomerAuthPage({ mode, redirectTo = "/" }: { mode: "register" | "login"; redirectTo?: string }) {
  const register = mode === "register";
  const [authEnabled, setAuthEnabled] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  useEffect(() => {
    let active = true;
    fetch("/api/auth/status", { cache: "no-store" })
      .then(response => response.json())
      .then(result => { if (active) setAuthEnabled(result.customerEnabled === true); })
      .catch(() => { if (active) setAuthEnabled(false); })
      .finally(() => { if (active) setStatusLoading(false); });
    return () => { active = false; };
  }, []);

  return <main className="dsk-auth-screen flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
    <div className="w-full max-w-md">
      <div className="mb-7 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#21382d] text-white shadow-lg"><Flame size={27}/></span>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.22em] text-[#e96d2c]">Damien's Smoky Kitchen</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#21382d]">{register ? "Create your account" : "Welcome back"}</h1>
        <p className="mt-2 text-sm leading-6 text-[#69766e]">{register ? "Create an account to enter the kitchen and manage your details." : "Sign in to continue to the menu."}</p>
      </div>
      <section className="dsk-auth-card rounded-[1.75rem] border border-[#e8e2d6] bg-white p-5 shadow-xl sm:p-7">
        {statusLoading ? <div className="py-10 text-center text-sm text-[#69766e]">Checking secure sign-in…</div> : !authEnabled ? (
          <div className="rounded-2xl bg-[#fff0e5] p-5 text-sm leading-6 text-[#8b401d]">
            <strong className="block text-[#21382d]">Secure sign-in is temporarily unavailable.</strong>
            <span className="mt-2 block">Please try again shortly. The menu stays private until your sign-in can be verified.</span>
          </div>
        ) : (
          <div className="flex justify-center">
            {register
              ? <SignUp routing="hash" signInUrl="/login" fallbackRedirectUrl={redirectTo} forceRedirectUrl={redirectTo} signInForceRedirectUrl={redirectTo} />
              : <SignIn routing="hash" signUpUrl="/create-account" fallbackRedirectUrl={redirectTo} forceRedirectUrl={redirectTo} signUpForceRedirectUrl={redirectTo} />}
          </div>
        )}
      </section>
      <p className="mt-6 text-center text-xs leading-5 text-[#879188]">Your account protects your personal details and keeps your kitchen experience private.</p>
    </div>
  </main>;
}


function KitchenAssistantWidget({ basket, open, onOpenChange, getToken }: { basket: BasketLine[]; open: boolean; onOpenChange: (value: boolean) => void; getToken: () => Promise<string | null> }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [introFinished, setIntroFinished] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const quickQuestions = ["Check a dish price", "Show vegan options", "Where do you deliver?"];
  const welcomeLetters = Array.from("WELCOME");

  useEffect(() => {
    if (!open) { setIntroFinished(false); setMessages([]); return; }
    const timer = window.setTimeout(() => setIntroFinished(true), 2600);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [open, messages, busy]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onOpenChange(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKeyDown); };
  }, [open, onOpenChange]);

  const ask = async (rawQuestion: string) => {
    const question = rawQuestion.trim();
    if (!question || busy) return;
    const next = [...messages, { role: "user" as const, content: question }];
    setMessages(next);
    setInput("");
    if (/\b(basket|cart)\b/i.test(question)) {
      const total = basket.reduce((sum, line) => sum + (line.item.price ?? 0) * line.quantity, 0);
      const details = basket.map(line => line.quantity + " × " + line.item.name + " (" + (line.item.price === null ? "price to confirm" : money(line.item.price * line.quantity)) + ")").join("\n");
      const answer = basket.length ? "Your basket has " + basket.length + " line(s):\n\n" + details + "\n\nSubtotal: " + money(total) + ". Delivery is calculated separately." : "Your basket is empty at the moment.";
      setMessages([...next, { role: "assistant", content: answer }]);
      return;
    }
    setBusy(true);
    try {
      const token = await getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = "Bearer " + token;
      const response = await fetch("/api/chat", { method: "POST", headers, body: JSON.stringify({ messages: next.slice(-12) }) });
      const body = await response.text();
      if (!response.ok) {
        let message = "The kitchen assistant is unavailable right now.";
        try { message = JSON.parse(body).error ?? message; } catch { /* safe fallback */ }
        throw new Error(message);
      }
      setMessages(current => [...current, { role: "assistant", content: body }]);
    } catch (error) {
      setMessages(current => [...current, { role: "assistant", content: error instanceof Error ? error.message : "The kitchen assistant is unavailable right now." }]);
    } finally { setBusy(false); }
  };
  const submit = (event: FormEvent) => { event.preventDefault(); void ask(input); };

  return <div className="dsk-assistant-widget">
    <button type="button" onClick={() => onOpenChange(true)} aria-expanded={open} aria-controls="dsk-assistant-panel" className="dsk-assistant-launcher">
      <MessageCircle size={23}/><span>Need help?</span><span className="dsk-assistant-online-dot" aria-hidden="true"/>
    </button>
    {open && <section id="dsk-assistant-panel" className="dsk-assistant-fullscreen" role="dialog" aria-label="Kitchen Assistant" aria-modal="true">
      <header className="dsk-assistant-topbar">
        <a href="/" className="dsk-assistant-brand" aria-label="Return to Damien's Smoky Kitchen"><span className="dsk-assistant-brand-mark"><Flame size={21}/></span><span>Damien's <b>Smoky Kitchen</b></span></a>
        <button type="button" onClick={() => onOpenChange(false)} aria-label="Close Kitchen Assistant" className="dsk-assistant-close"><X size={22}/><span>Close</span></button>
      </header>
      <div className="dsk-assistant-stage">
        <div className="dsk-assistant-intro">
          <span className="dsk-assistant-eyebrow">YOUR TABLE-SIDE HELPER</span>
          <h1 className="dsk-assistant-welcome" aria-label="Welcome">
            {welcomeLetters.map((letter, index) => <span key={index} className="dsk-assistant-letter" style={{ animationDelay: (index * 150) + "ms" }}>{letter}</span>)}
          </h1>
          <h2 className="dsk-assistant-title">Kitchen Assistant<span>.</span></h2>
          <p className={"dsk-assistant-prompt " + (introFinished ? "is-visible" : "")}>How can we be of help today?</p>
          <div className={"dsk-assistant-chat-area " + (introFinished ? "is-visible" : "")}>
            <div className="dsk-assistant-conversation" aria-live="polite">
              {messages.map((message, index) => <div key={index} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}><p className={message.role === "user" ? "max-w-[88%] whitespace-pre-line rounded-2xl rounded-br-sm bg-[#21382d] px-4 py-3 text-sm leading-6 text-white" : "max-w-[88%] whitespace-pre-line rounded-2xl rounded-bl-sm border border-[#e8e2d6] bg-white px-4 py-3 text-sm leading-6 text-[#29382d]"}>{message.content}</p></div>)}
              {messages.length === 0 && <div className="flex flex-wrap gap-2">{quickQuestions.map(question => <button key={question} type="button" disabled={busy} onClick={() => void ask(question)} className="rounded-full border border-[#d8dfd5] bg-white px-4 py-2.5 text-xs font-semibold text-[#526a50] transition hover:border-[#e96d2c] disabled:opacity-50">{question}</button>)}</div>}
              {busy && <p className="text-sm text-[#69766e]" role="status">Checking the latest kitchen information…</p>}<div ref={endRef}/>
            </div>
            <form onSubmit={submit} className="dsk-assistant-composer">
              <input value={input} onChange={event => setInput(event.target.value)} maxLength={2000} placeholder="Ask about dishes, prices or delivery…" aria-label="Message Kitchen Assistant" className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm outline-none"/>
              <button type="submit" disabled={!input.trim() || busy} aria-label="Send message" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#e96d2c] text-white transition hover:bg-[#cf5b25] disabled:opacity-45"><Send size={18}/></button>
            </form>
            <p className="mt-3 text-center text-[11px] text-[#899188]">For live prices and availability, the kitchen checks its current menu.</p>
            <p className="mt-2 text-center text-[11px] text-[#899188]">When signed in, food preferences and allergies you share are saved to your account. Say “forget my preferences” to clear them.</p>
          </div>
        </div>
      </div>
    </section>}
  </div>;
}

function StaffLoginPage() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [staffEnabled, setStaffEnabled] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/api/auth/status", { cache: "no-store" }).then(response => response.ok ? response.json() : Promise.reject(new Error("Staff status unavailable"))).then(result => {
      if (active) setStaffEnabled(result.staffEnabled === true);
    }).catch(() => { if (active) { setStaffEnabled(false); setStatusError(true); } }).finally(() => { if (active) setStatusLoading(false); });
    return () => { active = false; };
  }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !staffEnabled) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/staff/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, totpCode }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Staff login failed.");
      setLocation("/admin/dashboard");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Staff login failed."); }
    finally { setBusy(false); }
  };
  return <AuthShell title="Administrator & staff sign in" subtitle="Private staff access. Use your authorised account password and six-digit authenticator code.">
    {statusLoading ? <p className="mt-6 text-sm text-[#69766e]" role="status">Checking staff access…</p> : statusError ? <div className="mt-6 rounded-2xl bg-[#fff0e5] p-4 text-sm leading-6 text-[#8b401d]" role="alert"><strong className="block text-[#21382d]">We could not check staff sign-in.</strong><span className="mt-2 block">Check your connection and try again. This does not necessarily mean staff access is disabled.</span><button type="button" onClick={() => window.location.reload()} className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#8b401d]">Try again</button></div> : !staffEnabled ? <div className="mt-6 rounded-2xl bg-[#e8eee6] p-4 text-sm leading-6 text-[#52645a]"><strong className="block text-[#21382d]">Staff sign-in is not enabled yet.</strong><span className="mt-2 block">The administrator must configure the staff password and authenticator secret, then benchmark the Worker password-hashing workload before access can be enabled.</span></div> : <form onSubmit={submit} className="mt-7 space-y-4">
      <label className="block text-xs font-semibold">Authorised staff email<input required type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[#e5dfd3] bg-[#fbf8f1] px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#e96d2c]"/></label>
      <label className="block text-xs font-semibold">Password<input required type="password" autoComplete="current-password" minLength={12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[#e5dfd3] bg-[#fbf8f1] px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#e96d2c]"/></label>
      <label className="block text-xs font-semibold">Authenticator code<input required type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit code" className="mt-1.5 w-full rounded-xl border border-[#e5dfd3] bg-[#fbf8f1] px-3 py-3 text-sm tracking-[0.25em] outline-none focus:ring-2 focus:ring-[#e96d2c]"/><span className="mt-1 block text-[11px] font-normal text-[#7b887f]">Open your authenticator app to get the current code.</span></label>
      {error && <p role="alert" className="rounded-xl bg-[#fff0e5] p-3 text-xs leading-5 text-[#8b401d]">{error}</p>}
      <button disabled={busy} className="w-full rounded-xl bg-[#21382d] px-4 py-3.5 text-sm font-bold text-white disabled:opacity-60">{busy ? "Verifying…" : "Sign in to staff portal"}</button>
    </form>}
    <p className="mt-6 text-center text-xs"><Link href="/login" className="font-semibold text-[#b64a1a]">Customer login</Link></p>
  </AuthShell>;
}

function StaffPortalPage() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [orders, setOrders] = useState<Array<{id:string;customer_name:string;customer_phone:string;delivery_address:string;subtotal_ngn:number;status:string;created_at:string;items:Array<{name:string;quantity:number;total:number}>}>>([]);
  const [logs, setLogs] = useState<Array<{id:number;actor:string;action:string;target_id:string|null;created_at:string}>>([]);
  const [section, setSection] = useState<"overview"|"orders"|"activity">("overview");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [busyOrder, setBusyOrder] = useState("");
  const load = async () => {
    const [orderResponse, logResponse] = await Promise.all([
      fetch("/api/staff/orders", { credentials:"same-origin", cache:"no-store" }),
      fetch("/api/staff/logs", { credentials:"same-origin", cache:"no-store" })
    ]);
    if (orderResponse.status === 401 || logResponse.status === 401) throw new Error("Your administrator session has expired. Please sign in again.");
    if (!orderResponse.ok || !logResponse.ok) throw new Error("Dashboard data could not be loaded. Refresh and try again.");
    const orderData = await orderResponse.json();
    const logData = await logResponse.json();
    setOrders(orderData.orders ?? []);
    setLogs(logData.logs ?? []);
  };
  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { credentials:"same-origin", cache:"no-store" }).then(async response => {
      if (!response.ok) throw new Error("Administrator login required.");
      const result = await response.json();
      if (result.role !== "staff") throw new Error("Administrator access required.");
      if (active) { setEmail(result.user.email); await load(); }
    }).catch(() => { if (active) setLocation("/staff/login"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [setLocation]);
  const logout = async () => {
    await fetch("/api/auth/logout", { method:"POST", credentials:"same-origin" });
    setLocation("/staff/login");
  };
  const refresh = async () => {
    setRefreshing(true); setError("");
    try { await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Refresh failed."); }
    finally { setRefreshing(false); }
  };
  const updateStatus = async (id:string, status:string) => {
    setBusyOrder(id); setError("");
    try {
      const response = await fetch("/api/staff/orders/"+encodeURIComponent(id), { method:"PATCH", credentials:"same-origin", headers:{"Content-Type":"application/json"}, body:JSON.stringify({status}) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Order update failed.");
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Order update failed."); }
    finally { setBusyOrder(""); }
  };
  const money = (amount:number) => "₦"+amount.toLocaleString("en-NG");
  const pending = orders.filter(order => order.status === "pending").length;
  const active = orders.filter(order => ["accepted","preparing","dispatched"].includes(order.status)).length;
  const completed = orders.filter(order => order.status === "completed").length;
  const filteredOrders = orders.filter(order => [order.customer_name, order.customer_phone, order.id, order.status].some(value => value.toLowerCase().includes(query.toLowerCase())));
  const nav = [
    { id:"overview" as const, label:"Overview", icon:"⌂" },
    { id:"orders" as const, label:"Orders", icon:"▤" },
    { id:"activity" as const, label:"Activity log", icon:"◷" }
  ];
  if (loading) return <main className="min-h-screen bg-[#f5f6f2] px-5 py-16 text-sm text-[#69766e]"><div className="mx-auto max-w-5xl rounded-2xl border border-[#e4e9e1] bg-white p-8">Verifying your private administrator session…</div></main>;
  return <main className="min-h-screen bg-[#f5f6f2] text-[#20372b]">
    <div className="mx-auto flex min-h-screen max-w-[1600px]">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#e5e9e2] bg-[#20372b] px-5 py-6 text-white md:flex">
        <div className="flex items-center gap-3 px-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e96d2c] text-xl font-black">D</span>
          <span><strong className="block text-sm">Damien's</strong><span className="text-xs text-white/60">Smoky Kitchen</span></span>
        </div>
        <p className="mb-3 mt-10 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-white/40">Workspace</p>
        <nav className="space-y-1">
          {nav.map(item=><button key={item.id} onClick={()=>setSection(item.id)} className={section===item.id?"flex w-full items-center gap-3 rounded-xl bg-white/12 px-3 py-3 text-left text-sm font-semibold text-white":"flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-white/65 transition hover:bg-white/8 hover:text-white"}><span className="w-5 text-center text-lg">{item.icon}</span>{item.label}{item.id==="orders"&&pending>0&&<span className="ml-auto rounded-full bg-[#e96d2c] px-2 py-0.5 text-[10px] font-bold">{pending}</span>}</button>)}
          <button onClick={()=>setLocation("/admin/menu")} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-white/65 transition hover:bg-white/8 hover:text-white"><span className="w-5 text-center text-lg">▦</span>Menu management</button>
        </nav>
        <div className="mt-8 border-t border-white/10 pt-5">
          <p className="px-3 text-[10px] font-bold uppercase tracking-[.2em] text-white/40">Coming next</p>
          <div className="mt-2 space-y-1 text-sm text-white/40">
            <div className="flex items-center gap-3 px-3 py-2"><span className="w-5 text-center">♙</span>Staff & permissions</div>
            <div className="flex items-center gap-3 px-3 py-2"><span className="w-5 text-center">⚙</span>Restaurant settings</div>
          </div>
        </div>
        <div className="mt-auto rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#f4b184]">Signed in</p>
          <p className="mt-1 break-all text-xs text-white/80">{email}</p>
          <p className="mt-2 text-[10px] text-white/45">Primary administrator · protected session</p>
        </div>
      </aside>
      <section className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e9e2] bg-[#fbfcf9]/95 px-4 py-4 backdrop-blur sm:px-7 lg:px-10">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#20372b] text-sm font-black text-white md:hidden">D</span>
            <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#8a958b]">Damien's Smoky Kitchen / Admin</p><h1 className="mt-0.5 text-lg font-extrabold tracking-tight sm:text-xl">{section==="overview"?"Overview":section==="orders"?"Order management":"Activity log"}</h1></div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-[#e4e9e1] bg-white px-3 py-2 text-[11px] font-semibold text-[#68786e] sm:inline-flex">● Private workspace</span>
            <button onClick={refresh} disabled={refreshing} className="rounded-xl border border-[#dfe5dc] bg-white px-3 py-2.5 text-xs font-bold text-[#314739] disabled:opacity-50">{refreshing?"Refreshing…":"↻ Refresh"}</button>
            <button onClick={logout} className="rounded-xl bg-[#20372b] px-3 py-2.5 text-xs font-bold text-white transition hover:bg-[#315541]">Sign out</button>
          </div>
        </header>
        <div className="border-b border-[#e5e9e2] bg-white px-4 py-2 md:hidden">
          <nav className="flex gap-2 overflow-x-auto">{nav.map(item=><button key={item.id} onClick={()=>setSection(item.id)} className={section===item.id?"shrink-0 rounded-lg bg-[#20372b] px-3 py-2 text-xs font-bold text-white":"shrink-0 rounded-lg bg-[#f1f3ee] px-3 py-2 text-xs font-semibold text-[#657469]"}>{item.label}</button>)}<button onClick={()=>setLocation("/admin/menu")} className="shrink-0 rounded-lg bg-[#f1f3ee] px-3 py-2 text-xs font-semibold text-[#657469]">Menu</button><button onClick={()=>setLocation("/admin/menu")} className="shrink-0 rounded-lg bg-[#f1f3ee] px-3 py-2 text-xs font-semibold text-[#657469]">Menu</button></nav>
        </div>
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-7 sm:py-8 lg:px-10">
          {error && <p role="alert" className="mb-5 rounded-xl border border-[#f2d3c3] bg-[#fff0e5] p-3 text-sm text-[#8b401d]">{error}</p>}
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-sm text-[#718075]">{section==="overview"?"Here is the latest activity from your kitchen.":section==="orders"?"Review and update saved order requests.":"A record of recent administrator actions."}</p><p className="mt-1 text-xs text-[#9aa39b]">Live data · Last 50 saved orders</p></div>
            <span className="rounded-full bg-[#edf2eb] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#526a50]">Admin account verified</span>
          </div>
          {section==="overview" && <>
            <div className="mb-5 rounded-2xl border border-[#f0d7b8] bg-[#fff8ed] p-4 sm:flex sm:items-center sm:justify-between">
              <div><p className="text-sm font-bold text-[#74451f]">Online ordering is currently disabled</p><p className="mt-1 text-xs leading-5 text-[#8a6749]">This dashboard will not accept or process customer orders until ordering is separately enabled and verified.</p></div>
              <span className="mt-3 inline-flex rounded-lg bg-[#f6e7d2] px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-[#85552c] sm:mt-0">Orders off</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-[#e4e9e1] bg-white p-5"><p className="text-xs font-semibold text-[#7a887d]">Orders in current view</p><p className="mt-3 text-3xl font-extrabold">{orders.length}</p><p className="mt-1 text-[11px] text-[#9aa39b]">Latest 50 records maximum</p></div>
              <div className="rounded-2xl border border-[#f0dfd3] bg-white p-5"><p className="text-xs font-semibold text-[#7a887d]">Awaiting review</p><p className="mt-3 text-3xl font-extrabold text-[#c65b2d]">{pending}</p><p className="mt-1 text-[11px] text-[#9aa39b]">Pending status</p></div>
              <div className="rounded-2xl border border-[#e4e9e1] bg-white p-5"><p className="text-xs font-semibold text-[#7a887d]">In progress</p><p className="mt-3 text-3xl font-extrabold">{active}</p><p className="mt-1 text-[11px] text-[#9aa39b]">Accepted, preparing, dispatched</p></div>
              <div className="rounded-2xl border border-[#e4e9e1] bg-white p-5"><p className="text-xs font-semibold text-[#7a887d]">Completed</p><p className="mt-3 text-3xl font-extrabold">{completed}</p><p className="mt-1 text-[11px] text-[#9aa39b]">Completed in current view</p></div>
            </div>
            <div className="mt-6 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
              <section className="overflow-hidden rounded-2xl border border-[#e4e9e1] bg-white">
                <div className="flex items-center justify-between border-b border-[#edf0ea] px-5 py-4"><div><h2 className="text-sm font-extrabold">Recent orders</h2><p className="mt-1 text-xs text-[#89948c]">Most recent saved requests</p></div><button onClick={()=>setSection("orders")} className="text-xs font-bold text-[#c65b2d]">View all →</button></div>
                {orders.length===0?<p className="p-8 text-sm text-[#89948c]">No saved orders found. Ordering is currently disabled.</p>:orders.slice(0,5).map(order=><div key={order.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f0f2ed] px-5 py-4 last:border-0"><div className="min-w-0"><p className="truncate text-sm font-bold">{order.customer_name}</p><p className="mt-1 text-[11px] text-[#89948c]">#{order.id.slice(0,8)} · {new Date(order.created_at).toLocaleDateString()}</p></div><div className="text-right"><p className="text-sm font-extrabold">{money(order.subtotal_ngn)}</p><span className="text-[10px] font-semibold capitalize text-[#758276]">{order.status}</span></div></div>)}
              </section>
              <section className="rounded-2xl border border-[#e4e9e1] bg-white p-5"><h2 className="text-sm font-extrabold">Workspace status</h2><div className="mt-4 space-y-4 text-xs"><div className="flex items-center justify-between gap-3"><span className="text-[#718075]">Administrator session</span><strong className="text-[#3f7652]">Verified</strong></div><div className="flex items-center justify-between gap-3"><span className="text-[#718075]">Audit logging</span><strong className="text-[#3f7652]">Available</strong></div><div className="flex items-center justify-between gap-3"><span className="text-[#718075]">Online ordering</span><strong className="text-[#b66a31]">Disabled</strong></div><div className="flex items-center justify-between gap-3"><span className="text-[#718075]">Menu editor</span><strong className="text-[#8a958b]">Not built</strong></div></div><div className="mt-5 rounded-xl bg-[#f5f6f2] p-3 text-[11px] leading-5 text-[#7a887d]">Revenue analytics are intentionally omitted until verified payment and order data are available.</div></section>
            </div>
          </>}
          {section==="orders" && <section className="overflow-hidden rounded-2xl border border-[#e4e9e1] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0ea] p-5"><div><h2 className="text-sm font-extrabold">Saved orders</h2><p className="mt-1 text-xs text-[#89948c]">Search by customer, phone, order ID or status.</p></div><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search orders…" className="w-full rounded-xl border border-[#dfe5dc] bg-[#fbfcf9] px-3 py-2.5 text-xs outline-none focus:border-[#e96d2c] sm:max-w-xs"/></div>
            {filteredOrders.length===0?<p className="p-8 text-center text-sm text-[#89948c]">{orders.length===0?"No saved orders found.":"No orders match that search."}</p>:<div className="divide-y divide-[#edf0ea]">{filteredOrders.map(order=><article key={order.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wide text-[#89948c]">Order · {order.id.slice(0,8)}</p><h3 className="mt-1 text-sm font-extrabold">{order.customer_name}</h3><p className="mt-1 break-words text-xs text-[#718075]">{order.customer_phone} · {order.delivery_address}</p><p className="mt-1 text-[10px] text-[#9aa39b]">{new Date(order.created_at).toLocaleString()}</p></div><div className="text-right"><p className="text-base font-extrabold">{money(order.subtotal_ngn)}</p><span className="mt-1 inline-block rounded-full bg-[#eef2eb] px-3 py-1 text-[10px] font-bold capitalize text-[#526a50]">{order.status}</span></div></div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#edf0ea] pt-3"><p className="text-xs leading-5 text-[#718075]">{order.items.map(item=>item.quantity+" × "+item.name).join(" · ")}</p><div className="flex flex-wrap gap-2">{order.status!=="completed"&&order.status!=="cancelled"&&<><select aria-label={"Update status for order "+order.id} disabled={busyOrder===order.id} value={order.status} onChange={e=>updateStatus(order.id,e.target.value)} className="rounded-lg border border-[#dfe5dc] bg-white px-3 py-2 text-xs font-semibold"><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="preparing">Preparing</option><option value="dispatched">Dispatched</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select><span className="self-center text-[10px] text-[#89948c]">{busyOrder===order.id?"Saving…":"Changes are recorded"}</span></>}</div></div>
            </article>)}</div>}
          </section>}
          {section==="activity" && <section className="overflow-hidden rounded-2xl border border-[#e4e9e1] bg-white"><div className="border-b border-[#edf0ea] px-5 py-4"><h2 className="text-sm font-extrabold">Administrator audit trail</h2><p className="mt-1 text-xs text-[#89948c]">Order status changes recorded by the backend.</p></div>{logs.length===0?<p className="p-8 text-sm text-[#89948c]">No administrator actions recorded yet.</p>:logs.map(log=><div key={log.id} className="flex flex-wrap justify-between gap-2 border-b border-[#f0f2ed] px-5 py-4 text-xs last:border-0"><span className="font-semibold text-[#314739]">{log.action}</span><span className="text-[#7a867c]">{log.actor} · {new Date(log.created_at).toLocaleString()}</span></div>)}</section>}
          <p className="mt-6 text-[11px] leading-5 text-[#929d93]">Private administrator area. Customer information is shown only to an authenticated staff session. Sign out when using a shared device.</p>
        </div>
      </section>
    </div>
  </main>;
}


function AdminMenuPage() {
  const [, setLocation] = useLocation();
  const [items, setItems] = useState<Array<{id:string;name:string;category:string;price:number|null;isVegan:boolean;isAvailable:boolean}>>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    const response = await fetch("/api/staff/menu", { credentials:"same-origin", cache:"no-store" });
    if (response.status === 401) throw new Error("Administrator login required.");
    if (!response.ok) throw new Error("Menu catalogue could not be loaded.");
    const data = await response.json();
    setItems(data.items ?? []);
  };
  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { credentials:"same-origin", cache:"no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Sign in required.");
        const profile = await response.json();
        if (profile.role !== "staff") throw new Error("Administrator access required.");
        await load();
      })
      .catch(() => { if (active) setLocation("/staff/login"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [setLocation]);
  const save = async (event: FormEvent<HTMLFormElement>, id?:string) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true); setMessage("");
    const payload = {
      name:String(data.get("name") ?? "").trim(),
      category:String(data.get("category") ?? "").trim(),
      price:data.get("price") === "" ? null : Number(data.get("price")),
      isVegan:data.get("isVegan") === "on",
      isAvailable:data.get("isAvailable") === "on",
      aliases:[],
    };
    try {
      const response = await fetch(id ? "/api/staff/menu/"+encodeURIComponent(id) : "/api/staff/menu", {
        method:id ? "PATCH" : "POST",
        credentials:"same-origin",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Menu change could not be saved.");
      await load();
      if (!id) form.reset();
      setMessage(id ? "Menu item saved and published." : "New menu item added and published.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Menu change failed.");
    } finally { setBusy(false); }
  };
  if (loading) return <main className="min-h-screen bg-[#f5f6f2] p-8 text-sm text-[#69766e]">Verifying administrator access…</main>;
  return <main className="min-h-screen bg-[#f5f6f2] text-[#20372b]">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e9e2] bg-white px-4 py-4 sm:px-8">
      <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#89948c]">Damien's Smoky Kitchen / Admin</p><h1 className="mt-1 text-xl font-extrabold">Menu management</h1></div>
      <div className="flex gap-2"><button onClick={()=>setLocation("/admin/dashboard")} className="rounded-xl border border-[#dfe5dc] px-4 py-2.5 text-xs font-bold">Dashboard</button><button onClick={async()=>{await fetch("/api/auth/logout",{method:"POST",credentials:"same-origin"});setLocation("/staff/login");}} className="rounded-xl bg-[#20372b] px-4 py-2.5 text-xs font-bold text-white">Sign out</button></div>
    </header>
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-7 sm:px-8">
      <div className="rounded-2xl border border-[#f0d7b8] bg-[#fff8ed] p-4 text-xs leading-5 text-[#80552e]">Menu edits are saved to the restaurant database and reflected on the public website. Existing food photos are not replaced or generated.</div>
      {message && <p role="status" className="rounded-xl bg-[#edf2eb] p-3 text-sm text-[#526a50]">{message}</p>}
      <form onSubmit={event=>void save(event)} className="grid gap-3 rounded-2xl border border-[#e4e9e1] bg-white p-5 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-1"><h2 className="text-sm font-extrabold">Add a dish</h2><p className="mt-1 text-xs text-[#89948c]">Create a menu entry.</p></div>
        <input name="name" required maxLength={100} placeholder="Dish name" className="rounded-xl border border-[#dfe5dc] px-3 py-2.5 text-sm"/>
        <input name="category" required maxLength={60} placeholder="Category" className="rounded-xl border border-[#dfe5dc] px-3 py-2.5 text-sm"/>
        <input name="price" type="number" min="0" max="10000000" placeholder="Price (₦)" className="rounded-xl border border-[#dfe5dc] px-3 py-2.5 text-sm"/>
        <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-xs"><input type="checkbox" name="isVegan"/> Vegan</label><button disabled={busy} className="rounded-xl bg-[#20372b] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">Add item</button></div>
      </form>
      <section className="overflow-hidden rounded-2xl border border-[#e4e9e1] bg-white">
        <div className="border-b border-[#edf0ea] px-5 py-4"><h2 className="text-sm font-extrabold">Current menu</h2><p className="mt-1 text-xs text-[#89948c]">{items.length} items in the database · save each row to publish its changes</p></div>
        <div className="divide-y divide-[#edf0ea]">
          {items.map(item=><form key={item.id} onSubmit={event=>void save(event,item.id)} className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_.7fr_auto_auto_auto] lg:items-center">
            <input name="name" aria-label="Dish name" defaultValue={item.name} required maxLength={100} className="min-w-0 rounded-lg border border-[#dfe5dc] px-3 py-2 text-xs font-semibold"/>
            <input name="category" aria-label="Category" defaultValue={item.category} required maxLength={60} className="min-w-0 rounded-lg border border-[#dfe5dc] px-3 py-2 text-xs"/>
            <input name="price" aria-label="Price in naira" type="number" min="0" max="10000000" defaultValue={item.price ?? ""} className="min-w-0 rounded-lg border border-[#dfe5dc] px-3 py-2 text-xs"/>
            <label className="flex items-center gap-2 text-[11px]"><input type="checkbox" name="isVegan" defaultChecked={item.isVegan}/> Vegan</label>
            <label className="flex items-center gap-2 text-[11px]"><input type="checkbox" name="isAvailable" defaultChecked={item.isAvailable}/> Available</label>
            <button disabled={busy} className="rounded-lg bg-[#20372b] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Save</button>
          </form>)}
        </div>
      </section>
    </div>
  </main>;
}

function NotFound() {
  return <main className="flex min-h-[70vh] items-center justify-center bg-[#f7f8f4] px-5 py-16 text-center">
    <section className="w-full max-w-xl">
      <div className="relative mx-auto grid h-36 w-36 place-items-center rounded-[2.5rem] bg-[#fff0cf]">
        <span className="text-6xl font-black tracking-tighter text-[#21382d]">404</span>
        <span className="absolute -right-2 -top-2 grid h-12 w-12 place-items-center rounded-2xl bg-[#e96d2c] text-white shadow-lg"><Flame size={23}/></span>
      </div>
      <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-[#e96d2c]">Wrong turn in the kitchen</p>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#21382d] sm:text-4xl">This page isn't on the menu.</h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#69766e]">The page may have moved, or the address may be incorrect. Let's get you back to something delicious.</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link href="/" className="inline-flex items-center gap-2 rounded-xl bg-[#21382d] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#315541]"><ArrowRight size={16}/> Back to home</Link>
        <Link href="/menu" className="inline-flex items-center gap-2 rounded-xl border border-[#d9d4c9] bg-white px-5 py-3 text-sm font-bold text-[#21382d] transition hover:border-[#e96d2c]">Explore the menu</Link>
      </div>
    </section>
  </main>;
}

export default App;
