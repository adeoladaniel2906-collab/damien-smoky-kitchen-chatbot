import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { Link, Route, Switch, useLocation } from 'wouter';
import { SignIn, SignUp, useAuth, useUser } from '@clerk/react';
import { ArrowRight, ChevronDown, Clock3, Flame, MapPin, MessageCircle, Minus, Plus, Search, ShoppingBag, Trash2, Truck, Utensils, WifiOff } from 'lucide-react';
import { restaurantKnowledge, type MenuItem } from '@/chatbot/knowledge';
import { CookieConsent } from '@/components/CookieConsent';
import { CookiePolicyPage, PrivacyPolicyPage, TermsPage } from '@/pages/LegalPages';

type CatalogItem = MenuItem & { id: string };
type BasketLine = { item: CatalogItem; quantity: number };
type ChatMessage = { role: 'user' | 'assistant'; content: string };

const catalog: CatalogItem[] = [...restaurantKnowledge.menu, ...restaurantKnowledge.drinksMenu, ...restaurantKnowledge.veganMenu]
  .map((item) => ({ ...item, id: `${item.category}:${item.name}:${item.price ?? 'ask'}` }));
const categories = Array.from(new Set(catalog.map((item) => item.category)));
const photoUrl = 'https://images.unsplash.com/photo-1638436684761-7e59f8a9072f?auto=format&fit=crop&fm=jpg&ixlib=rb-4.1.0&q=80&w=1600';

function money(value: number) {
  return '₦' + value.toLocaleString('en-NG');
}

const commonsPhoto = (file: string) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=900`;
const menuPhoto = (item: CatalogItem) => {
  const name = item.name.toLowerCase();
  if (name.includes('jollof')) return commonsPhoto('A Nigeria Jollof Rice with chicken.jpg');
  if (name.includes('fried rice')) return commonsPhoto('Fried Rice and Chicken.jpg');
  if (name.includes('ofada')) return commonsPhoto('Ofada Rice and Jollof Rice.jpg');
  if (name.includes('coconut rice')) return commonsPhoto('Isip (coconut) rice.jpg');
  if (name.includes('egusi')) return commonsPhoto('African dish,,Egusi Soup and Eba.jpg');
  if (name.includes('amala')) return commonsPhoto('Amala and ewedu.jpg');
  if (name.includes('pounded yam')) return commonsPhoto('EGUSI SOUP AND POUNDED YAM.JPG');
  if (name.includes('eba') || name.includes('fufu') || name.includes('ogbono') || name.includes('okra')) return commonsPhoto('Eba and Vegetable Soup with Fish.jpg');
  if (name.includes('puff puff')) return commonsPhoto('Nigerian-puff-puff-recipe.jpg');
  if (name.includes('akara')) return commonsPhoto('Akara with bread, good combination for breakfast.jpg');
  if (name.includes('moi moi')) return commonsPhoto('Images of a local dish in Nigeria called Moi-Moi.jpg');
  if (name.includes('plantain') || name.includes('dodo')) return commonsPhoto('FRYING PLANTAIN.jpg');
  if (name.includes('spaghetti') || name.includes('macaroni') || name.includes('indomie')) return commonsPhoto('Jollof Spaghettis with turkey wings.png');
  if (name.includes('catfish')) return commonsPhoto('African Cat-Fish Pepper Soup.jpg');
  if (name.includes('asun')) return commonsPhoto('Asun rice by Chef Phizzle. Native Delight. 03.jpg');
  if (name.includes('snail')) return commonsPhoto('Fried Snail Stew.jpg');
  if (name.includes('yam')) return commonsPhoto('Yam Pottage Longthroat Memoirs.jpg');
  if (name.includes('smoothie') || name.includes('juice') || name.includes('zobo') || name.includes('kunu') || name.includes('tigernut') || name.includes('sobo')) return 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=900&q=85';
  if (item.category.toLowerCase().includes('drink') || item.category.toLowerCase().includes('alcohol')) return 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=900&q=85';
  if (item.category.toLowerCase().includes('protein')) return commonsPhoto('A Nigeria Jollof Rice with chicken.jpg');
  if (item.category.toLowerCase().includes('small chops')) return commonsPhoto('Nigerian-puff-puff-recipe.jpg');
  if (item.category.toLowerCase().includes('breakfast')) return commonsPhoto('Akara and kwunu breakfast (beans cake and pap).jpg');
  if (item.category.toLowerCase().includes('side')) return commonsPhoto('FRYING PLANTAIN.jpg');
  if (item.category.toLowerCase().includes('rice')) return commonsPhoto('A Nigeria Jollof Rice with chicken.jpg');
  return commonsPhoto('African dish,,Egusi Soup and Eba.jpg');
};

function App() {
  const [location, setLocation] = useLocation();
  const { isLoaded, isSignedIn, signOut } = useAuth();
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
  const [search, setSearch] = useState('');

  useEffect(() => {
    localStorage.setItem('damien-basket-v1', JSON.stringify(basket.map(({ item, quantity }) => ({ id: item.id, quantity }))));
  }, [basket]);

  const count = basket.reduce((total, line) => total + line.quantity, 0);
  const isStaffArea = location.startsWith("/staff");
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
    setSearch(query);
    setLocation('/menu');
  };
  const handleSignOut = async () => {
    await signOut();
    setLocation("/login");
  };

  if (!isOnline) return <OfflinePage onRetry={() => window.location.reload()} />;
  if (!isLoaded) return <AppLoadingScreen />;
  // Staff has its own password + TOTP login. Every customer-facing route is Clerk-gated.
  if (!isStaffArea && !isSignedIn) {
    return <CustomerAuthPage mode={location === "/create-account" ? "register" : "login"} />;
  }

  return <div className="min-h-screen bg-[#fbf8f1] text-[#21382d]">
    {!isStaffArea && <header className="sticky top-0 z-40 border-b border-[#e6e1d6] bg-[#fbf8f1]/95 backdrop-blur">
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
        <nav className="hidden items-center gap-5 lg:flex"><Link href="/account" className="text-sm hover:text-[#e96d2c]">My account</Link><Link href="/menu" className={location === '/menu' ? 'text-sm font-semibold text-[#e96d2c]' : 'text-sm hover:text-[#e96d2c]'}>Menu</Link><Link href="/delivery" className="text-sm hover:text-[#e96d2c]">Delivery</Link><Link href="/assistant" className="text-sm hover:text-[#e96d2c]">Ask the kitchen</Link><button type="button" onClick={handleSignOut} className="text-sm font-semibold text-[#8a6254] hover:text-[#e96d2c]">Sign out</button></nav>
        <Link href="/checkout" className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#21382d] text-white hover:bg-[#315541]" aria-label={`Basket, ${count} items`}><ShoppingBag size={19}/>{count > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#e96d2c] px-1 text-[10px] font-bold">{count}</span>}</Link>
      </div>
      <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-[#ece7dc] px-4 py-2.5 text-xs lg:hidden"><Link href="/account">My account</Link><Link href="/menu">Menu</Link><Link href="/delivery">Delivery</Link><Link href="/assistant">Kitchen assistant</Link><button type="button" onClick={handleSignOut} className="font-semibold text-[#8a6254]">Sign out</button></nav>
    </header>}

    <Switch>
      <Route path="/"><Home onBrowse={openMenu} onAdd={add} basketCount={count}/></Route>
      <Route path="/menu"><MenuPage search={search} setSearch={setSearch} add={add} basket={basket}/></Route>
      <Route path="/delivery"><DeliveryPage/></Route>
      <Route path="/assistant"><AssistantPage/></Route>
      <Route path="/checkout"><CheckoutPage basket={basket} change={change} remove={remove} clear={() => setBasket([])}/></Route>
      <Route path="/create-account"><CustomerAuthPage mode="register"/></Route>
      <Route path="/login"><CustomerAuthPage mode="login"/></Route>
      <Route path="/staff/login"><StaffLoginPage/></Route>
      <Route path="/staff-login"><StaffLoginPage/></Route>
      <Route path="/account"><CustomerAccountPage/></Route>
      <Route path="/staff"><StaffPortalPage/></Route>
      <Route path="/privacy"><PrivacyPolicyPage/></Route>
      <Route path="/terms"><TermsPage/></Route>
      <Route path="/cookies"><CookiePolicyPage/></Route>
      <Route><NotFound/></Route>
    </Switch>

    {!isStaffArea && <footer className="mt-16 bg-[#21382d] text-white"><div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:grid-cols-3 sm:px-6"><div><div className="flex items-center gap-2 font-bold"><Flame size={18} className="text-[#f29a53}"/> Damien's Smoky Kitchen</div><p className="mt-3 max-w-xs text-sm leading-6 text-white/70">Nigerian dishes, made in Ibafo. Browse the menu and review your basket online.</p></div><div><p className="text-sm font-semibold">Visit and hours</p><p className="mt-3 text-sm leading-6 text-white/70">The Motorcycle Drive, Papa Olonrisa<br/>Ibafo, Ogun State<br/>Daily, 9:00 AM–9:00 PM</p></div><div><p className="text-sm font-semibold">Ordering information</p><p className="mt-3 text-sm leading-6 text-white/70">Lagos State delivery only<br/>Minimum delivery order: ₦3,000<br/>Fee depends on distance</p></div></div><div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-white/15 px-5 py-4 text-xs text-white/65"><span>© {new Date().getFullYear()} Damien's Smoky Kitchen</span><Link href="/privacy" className="underline underline-offset-4">Privacy</Link><Link href="/terms" className="underline underline-offset-4">Terms</Link><Link href="/cookies" className="underline underline-offset-4">Cookie notice</Link><button type="button" onClick={() => window.dispatchEvent(new Event("dsk:open-cookie-settings"))} className="underline underline-offset-4">Manage cookies</button></div></footer>}
    {!isStaffArea && <CookieConsent/>}
  </div>;
}

function AppLoadingScreen() {
  return <main className="flex min-h-screen items-center justify-center bg-[#fbf8f1] px-6 text-center">
    <div className="dsk-auth-card"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#21382d] text-white"><Flame size={25}/></span><p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-[#e96d2c]">Damien's Smoky Kitchen</p><p className="mt-3 text-sm text-[#69766e]">Preparing your secure sign-in…</p><span className="mx-auto mt-5 block h-1.5 w-28 overflow-hidden rounded-full bg-[#e8e2d6]"><span className="dsk-loading-bar block h-full rounded-full bg-[#e96d2c]"/></span></div>
  </main>;
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

function Home({ onBrowse, onAdd, basketCount }: { onBrowse: (query?: string) => void; onAdd: (item: CatalogItem) => void; basketCount: number }) {
  const featured = catalog.filter((item) => item.price !== null).slice(0, 8);
  const quickCategories = categories.slice(0, 8);
  return <main className="bg-[#f7f8f4]">
    <section className="mx-auto max-w-7xl px-4 pb-5 pt-5 sm:px-6">
      <div className="overflow-hidden rounded-[2rem] bg-[#ffc94a]">
        <div className="grid min-h-[360px] lg:grid-cols-[1.05fr_.95fr]">
          <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-14">
            <span className="w-fit rounded-full bg-white/70 px-3 py-1.5 text-xs font-bold text-[#26372c]">DAM IEN'S SMOKY KITCHEN · IBAFO</span>
            <h1 className="mt-5 max-w-xl text-4xl font-extrabold leading-[1.02] tracking-tight text-[#202a23] sm:text-6xl">Your next favourite meal is closer.</h1>
            <p className="mt-4 max-w-md text-base leading-7 text-[#39463b]">Nigerian favourites, freshly prepared. Explore the menu, add your picks and review your basket in a few taps.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button onClick={() => onBrowse()} className="inline-flex items-center gap-2 rounded-full bg-[#26372c] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#3c5543]">Explore the menu <ArrowRight size={17}/></button>
              <Link href="/delivery" className="inline-flex items-center gap-2 rounded-full border border-[#26372c]/25 bg-white/55 px-6 py-3.5 text-sm font-bold text-[#26372c] hover:bg-white/80">Delivery information</Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-[#39463b]"><span className="inline-flex items-center gap-1.5"><Clock3 size={14}/> Daily, 9 AM–9 PM</span><span className="inline-flex items-center gap-1.5"><Truck size={14}/> Lagos delivery</span><span className="inline-flex items-center gap-1.5"><MapPin size={14}/> Ibafo, Ogun State</span></div>
          </div>
          <div className="relative min-h-[260px] lg:min-h-full">
            <img src={photoUrl} alt="Freshly prepared Nigerian food served at a table" className="absolute inset-0 h-full w-full object-cover"/>
            <div className="absolute inset-0 bg-gradient-to-t from-[#172c21]/25 to-transparent"/>
            <div className="absolute bottom-5 left-5 rounded-2xl bg-white/95 px-4 py-3 shadow-lg backdrop-blur-sm sm:bottom-7 sm:left-7"><p className="text-[10px] font-bold uppercase tracking-widest text-[#68786e]">Made with care</p><p className="mt-1 text-sm font-extrabold text-[#26372c]">Good food. No guesswork.</p></div>
          </div>
        </div>
      </div>
    </section>
    <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
      <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-[#71816f]">What are you craving?</p><h2 className="mt-1 text-2xl font-extrabold tracking-tight text-[#26372c] sm:text-3xl">Explore categories</h2></div><Link href="/menu" className="text-sm font-bold text-[#526a50] hover:underline">View all</Link></div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">{quickCategories.map((category) => <button key={category} onClick={() => onBrowse(category)} className="group rounded-2xl border border-[#e7e9e2] bg-white px-3 py-4 text-left transition hover:-translate-y-1 hover:border-[#ffc94a] hover:shadow-md"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#fff3c9] text-[#4d6048] transition group-hover:bg-[#ffc94a]"><Utensils size={18}/></span><span className="mt-3 block text-sm font-bold text-[#29382d]">{category}</span><span className="mt-1 block text-[11px] text-[#7a857b]">Explore dishes</span></button>)}</div>
    </section>
    <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
      <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-[#71816f]">Picked from our kitchen</p><h2 className="mt-1 text-2xl font-extrabold tracking-tight text-[#26372c] sm:text-3xl">Popular right now</h2><p className="mt-1 text-sm text-[#7a857b]">Restaurant menu prices, clearly displayed.</p></div><span className="rounded-full bg-[#e9eee5] px-3 py-2 text-xs font-bold text-[#526a50]">{basketCount} in your basket</span></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{featured.map((item) => <ProductCard key={item.id} item={item} onAdd={() => onAdd(item)}/>)}</div>
      <Link href="/menu" className="mx-auto mt-8 flex w-fit items-center gap-2 rounded-full bg-[#26372c] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#3c5543]">Browse the full menu <ArrowRight size={16}/></Link>
    </section>
    <section className="mx-auto max-w-7xl px-4 pb-10 pt-5 sm:px-6"><div className="grid gap-4 md:grid-cols-2"><Link href="/delivery" className="flex items-center justify-between gap-4 rounded-3xl bg-[#e8eee6] p-6 transition hover:bg-[#dfe8dc]"><div><span className="text-xs font-bold uppercase tracking-widest text-[#71816f]">At your door</span><h2 className="mt-2 text-xl font-extrabold text-[#26372c]">Delivery across Lagos</h2><p className="mt-1 text-sm text-[#596b5d]">₦3,000 minimum order · Fee depends on distance</p></div><Truck size={30} className="shrink-0 text-[#526a50]"/></Link><Link href="/assistant" className="flex items-center justify-between gap-4 rounded-3xl bg-[#fff0cf] p-6 transition hover:bg-[#ffe7ad]"><div><span className="text-xs font-bold uppercase tracking-widest text-[#8a6c36]">Need a recommendation?</span><h2 className="mt-2 text-xl font-extrabold text-[#26372c]">Ask the kitchen</h2><p className="mt-1 text-sm text-[#756347]">Get help with menu and restaurant questions</p></div><MessageCircle size={30} className="shrink-0 text-[#8a6c36]"/></Link></div></section>
  </main>;
}

function ProductCard({ item, onAdd }: { item: CatalogItem; onAdd: () => void }) {
  return <article className="group overflow-hidden rounded-3xl border border-[#e7e9e2] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
    <div className="relative h-40 overflow-hidden bg-[#f0f1eb]"><img src={menuPhoto(item)} alt={`${item.name} food photography`} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105"/><span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#526a50]">{item.category}</span></div>
    <div className="p-4"><h3 className="min-h-10 font-bold leading-snug text-[#29382d]">{item.name}</h3><div className="mt-4 flex items-center justify-between gap-3"><strong className="text-base text-[#26372c]">{item.price === null ? 'Ask for price' : money(item.price)}</strong>{item.price !== null && <button onClick={onAdd} aria-label={`Add ${item.name} to basket`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#ffc94a] text-[#26372c] transition hover:bg-[#f4b923]"><Plus size={19}/></button>}</div></div>
  </article>;
}

function MenuPage({ search, setSearch, add, basket }: { search: string; setSearch: (value: string) => void; add: (item: CatalogItem) => void; basket: BasketLine[] }) {
  const [active, setActive] = useState('All');
  const categoriesWithAll = ['All', ...categories];
  const filtered = catalog.filter((item) => (active === 'All' || item.category === active) && `${item.name} ${item.category}`.toLowerCase().includes(search.toLowerCase()));
  const basketCount = basket.reduce((sum, line) => sum + line.quantity, 0);
  return <main className="mx-auto max-w-7xl bg-[#f7f8f4] px-4 py-8 sm:px-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-widest text-[#71816f]">Damien's Smoky Kitchen</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#26372c] sm:text-4xl">Explore the menu</h1><p className="mt-2 text-sm text-[#69766e]">Browse every dish, see the price and add your favourites to your basket.</p></div>
      <div className="rounded-2xl bg-[#fff0cf] px-4 py-3 text-xs font-semibold text-[#39463b]">Minimum delivery order <strong className="ml-1">₦3,000</strong></div>
    </div>
    <div className="sticky top-[72px] z-20 -mx-4 mt-6 border-y border-[#e7e9e2] bg-[#f7f8f4]/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
      <div className="flex gap-2 overflow-x-auto pb-1">{categoriesWithAll.map((category) => <button key={category} onClick={() => setActive(category)} className={active === category ? 'shrink-0 rounded-full bg-[#26372c] px-4 py-2.5 text-xs font-bold text-white' : 'shrink-0 rounded-full border border-[#dfe4dc] bg-white px-4 py-2.5 text-xs font-semibold text-[#526a50] transition hover:border-[#ffc94a]'}>{category}</button>)}</div>
    </div>
    <div className="mt-6 flex items-center justify-between gap-3"><p className="text-sm font-semibold text-[#526a50]">{filtered.length} menu items</p><p className="text-xs text-[#7a857b]">Prices in Nigerian naira</p></div>
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filtered.map((item) => <article key={item.id} className="group overflow-hidden rounded-3xl border border-[#e7e9e2] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div className="relative h-44 overflow-hidden bg-[#eef0e9]"><img src={menuPhoto(item)} alt={`${item.name} food photography`} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105"/><span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#526a50]">{item.category}</span></div>
      <div className="p-4"><h2 className="min-h-10 font-bold leading-snug text-[#29382d]">{item.name}</h2><div className="mt-4 flex items-center justify-between gap-3"><strong className="text-base text-[#26372c]">{item.price === null ? 'Ask for price' : money(item.price)}</strong>{item.price !== null && <button onClick={() => add(item)} aria-label={`Add ${item.name} to basket`} className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#ffc94a] px-4 py-2.5 text-xs font-bold text-[#26372c] transition hover:bg-[#f4b923]"><Plus size={15}/> Add</button>}</div></div>
    </article>)}</div>
    {filtered.length === 0 && <p className="rounded-2xl bg-white p-8 text-center text-sm text-[#69766e]">No menu items match that search.</p>}
    <aside className="fixed bottom-4 left-1/2 z-30 flex w-[min(92vw,560px)] -translate-x-1/2 items-center justify-between rounded-2xl bg-[#26372c] px-5 py-4 text-white shadow-xl"><span className="text-sm font-semibold">{basketCount} items in basket</span><Link href="/checkout" className="inline-flex items-center gap-2 rounded-xl bg-[#ffc94a] px-4 py-2.5 text-sm font-bold text-[#26372c]">Review basket <ArrowRight size={16}/></Link></aside>
  </main>;
}

function DeliveryPage() {
  return <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6"><p className="text-xs font-bold uppercase tracking-widest text-[#e96d2c]">Good to know</p><h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Delivery information</h1><div className="mt-8 grid gap-4 sm:grid-cols-2"><InfoCard icon={<MapPin/>} title="Where we deliver">Delivery is available within Lagos State only.</InfoCard><InfoCard icon={<ShoppingBag/>} title="Minimum order">The minimum delivery order is ₦3,000.</InfoCard><InfoCard icon={<Truck/>} title="Delivery fee">The fee depends on the delivery distance. The exact fee is not calculated on this site.</InfoCard><InfoCard icon={<Clock3/>} title="Opening hours">Daily, 9:00 AM–9:00 PM.</InfoCard></div><section className="mt-8 rounded-3xl bg-[#21382d] p-6 text-white sm:p-8"><h2 className="text-xl font-bold">Restaurant location</h2><p className="mt-3 text-sm leading-6 text-white/75">The Motorcycle Drive, Papa Olonrisa, Ibafo, Ogun State.</p><p className="mt-5 text-sm text-white/75">Add your items to the basket to review them. Delivery availability and distance-based fees must be confirmed before an order is completed.</p><Link href="/menu" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#e96d2c] px-4 py-3 text-sm font-bold">Browse menu <ArrowRight size={16}/></Link></section></main>;
}

function InfoCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return <article className="rounded-2xl border border-[#e8e2d6] bg-white p-5"><span className="text-[#e96d2c]">{icon}</span><h2 className="mt-3 font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-[#69766e]">{children}</p></article>;
}

function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', content: 'Káàbọ̀! Ask about the menu, prices, opening hours, location, or delivery.' }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async (event: FormEvent) => {
    event.preventDefault();
    const question = input.trim();
    if (!question || busy) return;
    const next = [...messages, { role: 'user' as const, content: question }];
    setMessages(next);
    setInput('');
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
  return <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[.8fr_1.2fr]"><section><p className="text-xs font-bold uppercase tracking-widest text-[#e96d2c]">Kitchen assistant</p><h1 className="mt-2 text-3xl font-extrabold">Ask about the food.</h1><p className="mt-4 text-sm leading-6 text-[#69766e]">Answers use the restaurant's menu and information. If a detail isn't listed, the assistant will say so instead of guessing.</p><div className="mt-6 rounded-2xl bg-[#e8eee6] p-5 text-sm leading-6"><strong>Quick questions</strong><div className="mt-3 flex flex-wrap gap-2">{['Show the menu', 'What time do you close?', 'Where do you deliver?'].map((text) => <button key={text} onClick={() => setInput(text)} className="rounded-full border border-[#cbd8cd] bg-white px-3 py-2 text-xs hover:border-[#e96d2c]">{text}</button>)}</div></div></section><section className="flex min-h-[540px] flex-col overflow-hidden rounded-3xl border border-[#e8e2d6] bg-white shadow-sm"><header className="flex items-center gap-3 border-b border-[#eee9df] p-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#21382d] text-white"><Flame size={19}/></span><span><strong className="block text-sm">Damien's kitchen</strong><small className="text-xs text-[#69766e]">Menu and restaurant help</small></span></header><div className="flex-1 space-y-3 overflow-y-auto bg-[#fbf8f1] p-4">{messages.map((message, index) => <div key={index} className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}><p className={message.role === 'user' ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-[#21382d] px-4 py-3 text-sm leading-6 text-white' : 'max-w-[85%] rounded-2xl rounded-bl-sm border border-[#e8e2d6] bg-white px-4 py-3 text-sm leading-6'}>{message.content}</p></div>)}{busy && <p className="text-xs text-[#69766e]">Checking the kitchen information…</p>}</div><form onSubmit={send} className="flex gap-2 border-t border-[#eee9df] p-3"><input value={input} maxLength={2000} onChange={(event) => setInput(event.target.value)} placeholder="Ask about dishes, prices or delivery" className="min-w-0 flex-1 rounded-xl bg-[#f0ece2] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#e96d2c]"/><button disabled={busy || !input.trim()} className="rounded-xl bg-[#e96d2c] px-4 text-white disabled:opacity-50" aria-label="Send question"><ArrowRight size={18}/></button></form></section></main>;
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
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [confirmation, setConfirmation] = useState<{ orderId: string; message: string } | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/orders/status', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : Promise.reject(new Error('Checkout status unavailable')))
      .then(result => { if (active) setOrdersEnabled(result.enabled === true); })
      .catch(() => { if (active) setOrdersEnabled(false); })
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
        {basket.map(({ item, quantity }) => <article key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[#e8e2d6] bg-white p-4"><div><h2 className="font-bold">{item.name}</h2><p className="mt-1 text-xs text-[#69766e]">{item.category} · {money(item.price ?? 0)} each</p></div><div className="flex items-center gap-2"><button onClick={() => change(item.id, -1)} className="grid h-8 w-8 place-items-center rounded-lg border" aria-label={`Remove one ${item.name}`}><Minus size={14}/></button><span className="w-5 text-center text-sm font-semibold">{quantity}</span><button onClick={() => change(item.id, 1)} className="grid h-8 w-8 place-items-center rounded-lg border" aria-label={`Add one ${item.name}`}><Plus size={14}/></button><button onClick={() => remove(item.id)} className="ml-1 text-[#8a6254]" aria-label={`Remove ${item.name}`}><Trash2 size={16}/></button></div></article>)}
        <button onClick={clear} className="text-xs font-semibold text-[#8a6254]">Clear basket</button>
        <div className="rounded-2xl bg-[#e8eee6] p-4 text-sm"><strong>Delivery fee:</strong> depends on distance and is not included in this subtotal. The restaurant must confirm it.</div>
      </section>
      <section className="rounded-3xl border border-[#e8e2d6] bg-white p-5 sm:p-7">
        <div className="flex justify-between border-b border-[#eee9df] pb-4"><span className="text-sm">Food subtotal</span><strong>{money(subtotal)}</strong></div>
        <p className="py-4 text-xs leading-5 text-[#69766e]">Minimum delivery order: {money(restaurantKnowledge.minimumDeliveryOrder)}. Delivery is limited to Lagos State.</p>
        {!meetsMinimum && <p className="mb-4 rounded-xl bg-[#fff0e5] p-3 text-xs text-[#8b401d]">Add {money(restaurantKnowledge.minimumDeliveryOrder - subtotal)} more to meet the delivery minimum.</p>}
        {orderStatusLoading ? <p className="rounded-xl bg-[#e8eee6] p-4 text-xs leading-5 text-[#52645a]">Checking secure checkout availability…</p> : !ordersEnabled ? <div className="rounded-xl bg-[#e8eee6] p-4 text-sm leading-6 text-[#52645a]"><strong className="block text-[#21382d]">Online ordering is temporarily unavailable.</strong><p className="mt-2">We are completing the data-protection and secure order-processing setup. Your name, phone number and delivery address are not being requested or submitted here. You can still browse the menu.</p></div> : <form onSubmit={submitOrder} className="space-y-3">
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

function CustomerAuthPage({ mode }: { mode: "register" | "login" }) {
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
        <p className="mt-2 text-sm leading-6 text-[#69766e]">{register ? "Create an account to enter the kitchen and manage your details." : "Sign in to continue to the menu and your customer account."}</p>
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
              ? <SignUp routing="hash" signInUrl="/login" fallbackRedirectUrl="/account" />
              : <SignIn routing="hash" signUpUrl="/create-account" fallbackRedirectUrl="/account" />}
          </div>
        )}
      </section>
      <p className="mt-6 text-center text-xs leading-5 text-[#879188]">Your account protects your personal details and keeps your kitchen experience private.</p>
    </div>
  </main>;
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
  useEffect(() => {
    let active = true;
    fetch("/api/auth/status", { cache: "no-store" }).then(response => response.json()).then(result => {
      if (active) setStaffEnabled(result.staffEnabled === true);
    }).catch(() => { if (active) setStaffEnabled(false); }).finally(() => { if (active) setStatusLoading(false); });
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
      setLocation("/staff");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Staff login failed."); }
    finally { setBusy(false); }
  };
  return <AuthShell title="Administrator & staff sign in" subtitle="Private staff access. Use your authorised account password and six-digit authenticator code.">
    {statusLoading ? <p className="mt-6 text-sm text-[#69766e]">Checking staff access…</p> : !staffEnabled ? <div className="mt-6 rounded-2xl bg-[#e8eee6] p-4 text-sm leading-6 text-[#52645a]"><strong className="block text-[#21382d]">Staff sign-in is not enabled yet.</strong><span className="mt-2 block">The administrator must configure the staff password and authenticator secret, then benchmark the Worker password-hashing workload before access can be enabled.</span></div> : <form onSubmit={submit} className="mt-7 space-y-4">
      <label className="block text-xs font-semibold">Authorised staff email<input required type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[#e5dfd3] bg-[#fbf8f1] px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#e96d2c]"/></label>
      <label className="block text-xs font-semibold">Password<input required type="password" autoComplete="current-password" minLength={12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[#e5dfd3] bg-[#fbf8f1] px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#e96d2c]"/></label>
      <label className="block text-xs font-semibold">Authenticator code<input required type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit code" className="mt-1.5 w-full rounded-xl border border-[#e5dfd3] bg-[#fbf8f1] px-3 py-3 text-sm tracking-[0.25em] outline-none focus:ring-2 focus:ring-[#e96d2c]"/><span className="mt-1 block text-[11px] font-normal text-[#7b887f]">Open your authenticator app to get the current code.</span></label>
      {error && <p role="alert" className="rounded-xl bg-[#fff0e5] p-3 text-xs leading-5 text-[#8b401d]">{error}</p>}
      <button disabled={busy} className="w-full rounded-xl bg-[#21382d] px-4 py-3.5 text-sm font-bold text-white disabled:opacity-60">{busy ? "Verifying…" : "Sign in to staff portal"}</button>
    </form>}
    <p className="mt-6 text-center text-xs"><Link href="/login" className="font-semibold text-[#b64a1a]">Customer login</Link></p>
  </AuthShell>;
}

function CustomerAccountPage() {
  const [, setLocation] = useLocation();
  const { isLoaded, isSignedIn, getToken, signOut } = useAuth();
  const { user: clerkUser } = useUser();
  const [profile, setProfile] = useState<{ name: string; email: string; phone: string } | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [phone, setPhone] = useState("");
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!isLoaded) return () => { active = false; };
    if (!isSignedIn) {
      setLocation("/login");
      setLoading(false);
      return () => { active = false; };
    }
    (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("Your sign-in session could not be verified. Please sign in again.");
        const response = await fetch("/api/auth/me", {
          headers: { Authorization: "Bearer " + token },
          credentials: "same-origin",
          cache: "no-store",
        });
        const result = await response.json() as {
          error?: string;
          needsProfile?: boolean;
          user?: { name: string; email: string; phone: string };
        };
        if (response.status === 401) throw new Error("Your sign-in session has expired. Please sign in again.");
        if (!response.ok) throw new Error(result.error ?? "We could not load your customer profile.");
        if (active) {
          if (result.needsProfile) {
            setNeedsProfile(true);
            setPhone(clerkUser?.primaryPhoneNumber?.phoneNumber ?? "");
          } else if (result.user) {
            setProfile(result.user);
            setPhone(result.user.phone);
          }
        }
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "We could not load your account.");
          if (caught instanceof Error && caught.message.includes("sign in again")) setLocation("/login");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [isLoaded, isSignedIn, getToken, setLocation, clerkUser]);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const token = await getToken();
      if (!token) throw new Error("Your sign-in session has expired. Please sign in again.");
      const response = await fetch("/api/auth/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        credentials: "same-origin",
        body: JSON.stringify({ phone, adultConfirmed }),
      });
      const result = await response.json() as { error?: string; user?: { name: string; email: string; phone: string } };
      if (!response.ok || !result.user) throw new Error(result.error ?? "We could not save your profile.");
      setProfile(result.user);
      setNeedsProfile(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not save your profile.");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await signOut();
    setLocation("/login");
  };

  return <AuthShell title="Your account" subtitle="Your customer profile is securely connected to your Clerk sign-in.">
    {loading || !isLoaded ? <p className="mt-6 text-sm text-[#69766e]">Verifying your customer session…</p> : profile ? (
      <div className="mt-6 space-y-3 text-sm">
        <p><strong>Name:</strong> {profile.name}</p>
        <p><strong>Email:</strong> {profile.email}</p>
        <p><strong>Phone:</strong> {profile.phone}</p>
        <button onClick={logout} className="mt-4 w-full rounded-xl border border-[#d9d4c9] px-4 py-3 text-sm font-semibold">Log out</button>
        <p className="border-t border-[#e8e2d6] pt-4 text-xs leading-5 text-[#7b887f]">Order history will appear here after secure customer-owned ordering is enabled. To request account deletion, contact the restaurant.</p>
      </div>
    ) : needsProfile ? (
      <form onSubmit={saveProfile} className="mt-6 space-y-4">
        <div className="rounded-xl bg-[#f0f4ed] p-3 text-xs leading-5 text-[#52645a]">
          Your Clerk sign-in is verified. Add a phone number to finish setting up your customer profile.
        </div>
        <label className="block text-xs font-semibold">Phone number
          <input required type="tel" autoComplete="tel" minLength={8} maxLength={24} value={phone} onChange={event => setPhone(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[#e5dfd3] bg-[#fbf8f1] px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#e96d2c]" />
        </label>
        <label className="flex items-start gap-2 text-xs leading-5 text-[#69766e]">
          <input type="checkbox" required checked={adultConfirmed} onChange={event => setAdultConfirmed(event.target.checked)} className="mt-1 accent-[#e96d2c]" />
          I confirm I am 18 or older and have read the <Link href="/privacy" className="font-semibold underline">Privacy Notice</Link>. A parent or legal guardian must place an order for a child using their own details.
        </label>
        {error && <p role="alert" className="rounded-xl bg-[#fff0e5] p-3 text-xs leading-5 text-[#8b401d]">{error}</p>}
        <button disabled={busy} className="w-full rounded-xl bg-[#21382d] px-4 py-3.5 text-sm font-bold text-white disabled:opacity-60">{busy ? "Saving profile…" : "Finish account setup"}</button>
        <button type="button" onClick={logout} className="w-full rounded-xl border border-[#d9d4c9] px-4 py-3 text-sm font-semibold">Sign out</button>
      </form>
    ) : (
      <div className="mt-6 space-y-3">
        {error && <p role="alert" className="rounded-xl bg-[#fff0e5] p-3 text-xs leading-5 text-[#8b401d]">{error}</p>}
        <p className="text-sm text-[#69766e]">We could not load your customer profile.</p>
        <button onClick={logout} className="w-full rounded-xl border border-[#d9d4c9] px-4 py-3 text-sm font-semibold">Sign out</button>
      </div>
    )}
  </AuthShell>;
}

function StaffPortalPage() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [orders, setOrders] = useState<Array<{id:string;customer_name:string;customer_phone:string;delivery_address:string;subtotal_ngn:number;status:string;created_at:string;items:Array<{name:string;quantity:number;total:number}>}>>([]);
  const [logs, setLogs] = useState<Array<{id:number;actor:string;action:string;target_id:string|null;created_at:string}>>([]);
  const [tab, setTab] = useState<"orders"|"activity">("orders");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyOrder, setBusyOrder] = useState("");
  const load = async () => {
    const [orderResponse, logResponse] = await Promise.all([
      fetch("/api/staff/orders", { credentials:"same-origin", cache:"no-store" }),
      fetch("/api/staff/logs", { credentials:"same-origin", cache:"no-store" })
    ]);
    if (orderResponse.status === 401 || logResponse.status === 401) throw new Error("Your staff session has expired. Please sign in again.");
    if (!orderResponse.ok || !logResponse.ok) throw new Error("The operations data could not be loaded.");
    const orderData = await orderResponse.json();
    const logData = await logResponse.json();
    setOrders(orderData.orders ?? []);
    setLogs(logData.logs ?? []);
  };
  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { credentials:"same-origin", cache:"no-store" }).then(async response => {
      if (!response.ok) throw new Error("Staff login required.");
      const result = await response.json();
      if (result.role !== "staff") throw new Error("Staff access required.");
      if (active) { setEmail(result.user.email); await load(); }
    }).catch(() => { if (active) setLocation("/staff/login"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [setLocation]);
  const logout = async () => { await fetch("/api/auth/logout", { method:"POST", credentials:"same-origin" }); setLocation("/staff-login"); };
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
  if (loading) return <main className="mx-auto max-w-7xl px-4 py-16 text-sm text-[#69766e]">Verifying your private staff session…</main>;
  return <main className="min-h-[75vh] bg-[#f6f7f3] px-4 py-8 sm:px-6">
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#738174]">Private operations</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#20372b] sm:text-4xl">Kitchen dashboard</h1><p className="mt-2 text-sm text-[#6b776e]">Signed in as {email}. Staff-only access.</p></div>
        <button onClick={logout} className="rounded-xl border border-[#d9dfd6] bg-white px-4 py-2.5 text-sm font-semibold text-[#314739]">Sign out</button>
      </div>
      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#e4e9e1] bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-[#778478]">Orders shown</p><p className="mt-2 text-3xl font-extrabold text-[#20372b]">{orders.length}</p><p className="mt-1 text-xs text-[#7a867c]">Most recent 50 orders</p></div>
        <div className="rounded-2xl border border-[#e4e9e1] bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-[#778478]">Awaiting review</p><p className="mt-2 text-3xl font-extrabold text-[#c45b2b]">{pending}</p><p className="mt-1 text-xs text-[#7a867c]">Pending restaurant confirmation</p></div>
        <div className="rounded-2xl border border-[#e4e9e1] bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-[#778478]">In progress</p><p className="mt-2 text-3xl font-extrabold text-[#20372b]">{active}</p><p className="mt-1 text-xs text-[#7a867c]">Accepted, preparing or dispatched</p></div>
      </div>
      <div className="mt-7 flex items-center gap-2 border-b border-[#dfe5dc]">
        <button onClick={()=>setTab("orders")} className={tab==="orders"?"border-b-2 border-[#df7139] px-4 py-3 text-sm font-bold text-[#20372b]":"px-4 py-3 text-sm font-semibold text-[#7a867c]"}>Orders</button>
        <button onClick={()=>setTab("activity")} className={tab==="activity"?"border-b-2 border-[#df7139] px-4 py-3 text-sm font-bold text-[#20372b]":"px-4 py-3 text-sm font-semibold text-[#7a867c]"}>Audit activity</button>
        <button onClick={()=>{load().catch(e=>setError(e.message));}} className="ml-auto rounded-lg px-3 py-2 text-xs font-semibold text-[#526a50]">Refresh</button>
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl bg-[#fff0e5] p-3 text-sm text-[#8b401d]">{error}</p>}
      {tab==="orders" ? <div className="mt-5 space-y-3">{orders.length===0 ? <div className="rounded-2xl border border-dashed border-[#cbd5c9] bg-white p-10 text-center"><p className="font-bold text-[#314739]">No saved orders yet</p><p className="mt-2 text-sm text-[#7a867c]">New order requests will appear here when online ordering is securely enabled.</p></div> : orders.map(order=><article key={order.id} className="rounded-2xl border border-[#e4e9e1] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-[#7b887f]">Order · {order.id.slice(0,8)}</p><h2 className="mt-1 text-lg font-bold text-[#20372b]">{order.customer_name}</h2><p className="mt-1 text-sm text-[#66746a]">{order.customer_phone} · {order.delivery_address}</p><p className="mt-1 text-xs text-[#8a948c]">{new Date(order.created_at).toLocaleString()}</p></div><div className="text-right"><p className="text-lg font-extrabold text-[#20372b]">{money(order.subtotal_ngn)}</p><span className="mt-1 inline-block rounded-full bg-[#eef2eb] px-3 py-1 text-xs font-semibold capitalize text-[#526a50]">{order.status}</span></div></div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#edf0ea] pt-3"><p className="text-xs text-[#69766e]">{order.items.map(item=>item.quantity+" × "+item.name).join(" · ")}</p><div className="flex flex-wrap gap-2">{order.status!=="completed"&&order.status!=="cancelled"&&<><select aria-label={"Update status for order "+order.id} disabled={busyOrder===order.id} value={order.status} onChange={e=>updateStatus(order.id,e.target.value)} className="rounded-lg border border-[#dfe5dc] bg-white px-3 py-2 text-xs font-semibold"><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="preparing">Preparing</option><option value="dispatched">Dispatched</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select><span className="self-center text-[10px] text-[#89948c]">{busyOrder===order.id?"Saving…":"Status changes are audited"}</span></>}</div></div>
      </article>)}</div> : <div className="mt-5 overflow-hidden rounded-2xl border border-[#e4e9e1] bg-white"><div className="border-b border-[#edf0ea] px-5 py-4"><h2 className="font-bold text-[#20372b]">Staff audit trail</h2><p className="mt-1 text-xs text-[#7a867c]">Order status changes only. Customer details and credentials are never written to this log.</p></div>{logs.length===0?<p className="p-6 text-sm text-[#7a867c]">No staff actions recorded yet.</p>:logs.map(log=><div key={log.id} className="flex flex-wrap justify-between gap-2 border-b border-[#f0f2ed] px-5 py-3 text-xs"><span className="font-semibold text-[#314739]">{log.action}</span><span className="text-[#7a867c]">{log.actor} · {new Date(log.created_at).toLocaleString()}</span></div>)}</div>}
      <p className="mt-6 text-xs leading-5 text-[#89948c]">Customer information is displayed only inside this authenticated staff area. Keep this screen private and sign out on shared devices.</p>
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
