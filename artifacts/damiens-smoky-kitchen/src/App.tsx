import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { Link, Route, Switch, useLocation } from 'wouter';
import { ArrowRight, ChevronDown, Clock3, Flame, MapPin, MessageCircle, Minus, Plus, Search, ShoppingBag, Trash2, Truck, Utensils } from 'lucide-react';
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

function App() {
  const [location, setLocation] = useLocation();
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

  return <div className="min-h-screen bg-[#fbf8f1] text-[#21382d]">
    <header className="sticky top-0 z-40 border-b border-[#e6e1d6] bg-[#fbf8f1]/95 backdrop-blur">
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
        <nav className="hidden items-center gap-5 lg:flex"><Link href="/login" className="text-sm hover:text-[#e96d2c]">Log in</Link><Link href="/create-account" className="text-sm hover:text-[#e96d2c]">Create account</Link><Link href="/staff-login" className="text-sm hover:text-[#e96d2c]">Staff</Link><Link href="/menu" className={location === '/menu' ? 'text-sm font-semibold text-[#e96d2c]' : 'text-sm hover:text-[#e96d2c]'}>Menu</Link><Link href="/delivery" className="text-sm hover:text-[#e96d2c]">Delivery</Link><Link href="/assistant" className="text-sm hover:text-[#e96d2c]">Ask the kitchen</Link></nav>
        <Link href="/checkout" className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#21382d] text-white hover:bg-[#315541]" aria-label={`Basket, ${count} items`}><ShoppingBag size={19}/>{count > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#e96d2c] px-1 text-[10px] font-bold">{count}</span>}</Link>
      </div>
      <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-[#ece7dc] px-4 py-2.5 text-xs lg:hidden"><Link href="/login">Log in</Link><Link href="/create-account">Create account</Link><Link href="/staff-login">Staff</Link><Link href="/menu">Menu</Link><Link href="/delivery">Delivery</Link><Link href="/assistant">Kitchen assistant</Link></nav>
    </header>

    <Switch>
      <Route path="/"><Home onBrowse={openMenu} onAdd={add} basketCount={count}/></Route>
      <Route path="/menu"><MenuPage search={search} setSearch={setSearch} add={add} basket={basket}/></Route>
      <Route path="/delivery"><DeliveryPage/></Route>
      <Route path="/assistant"><AssistantPage/></Route>
      <Route path="/checkout"><CheckoutPage basket={basket} change={change} remove={remove} clear={() => setBasket([])}/></Route>
      <Route path="/create-account"><CustomerAuthPage mode="register"/></Route>
      <Route path="/login"><CustomerAuthPage mode="login"/></Route>
      <Route path="/staff-login"><StaffLoginPage/></Route>
      <Route path="/account"><CustomerAccountPage/></Route>
      <Route path="/staff"><StaffPortalPage/></Route>
      <Route path="/privacy"><PrivacyPolicyPage/></Route>
      <Route path="/terms"><TermsPage/></Route>
      <Route path="/cookies"><CookiePolicyPage/></Route>
      <Route><NotFound/></Route>
    </Switch>

    <footer className="mt-16 bg-[#21382d] text-white"><div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:grid-cols-3 sm:px-6"><div><div className="flex items-center gap-2 font-bold"><Flame size={18} className="text-[#f29a53]"/> Damien's Smoky Kitchen</div><p className="mt-3 max-w-xs text-sm leading-6 text-white/70">Nigerian dishes, made in Ibafo. Browse the menu and review your basket online.</p></div><div><p className="text-sm font-semibold">Visit and hours</p><p className="mt-3 text-sm leading-6 text-white/70">The Motorcycle Drive, Papa Olonrisa<br/>Ibafo, Ogun State<br/>Daily, 9:00 AM–9:00 PM</p></div><div><p className="text-sm font-semibold">Ordering information</p><p className="mt-3 text-sm leading-6 text-white/70">Lagos State delivery only<br/>Minimum delivery order: ₦3,000<br/>Fee depends on distance</p></div></div><div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-white/15 px-5 py-4 text-xs text-white/65"><span>© {new Date().getFullYear()} Damien's Smoky Kitchen</span><Link href="/privacy" className="underline underline-offset-4">Privacy</Link><Link href="/terms" className="underline underline-offset-4">Terms</Link><Link href="/cookies" className="underline underline-offset-4">Cookie notice</Link><button type="button" onClick={() => window.dispatchEvent(new Event("dsk:open-cookie-settings"))} className="underline underline-offset-4">Manage cookies</button></div></footer>
    <CookieConsent/>
  </div>;
}

function Home({ onBrowse, onAdd, basketCount }: { onBrowse: (query?: string) => void; onAdd: (item: CatalogItem) => void; basketCount: number }) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  const featured = catalog.filter((item) => item.price !== null).slice(0, 8);
  const quickCategories = categories.slice(0, 8);
  return <main>
    <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-9 pt-7 sm:px-6 lg:grid-cols-[1.5fr_.8fr] lg:pt-10">
      <div className="relative min-h-[300px] overflow-hidden rounded-3xl bg-[#21382d] text-white sm:min-h-[370px]">
        <img src={photoUrl} alt="Nigerian jollof rice with chicken and sauce, illustrative food photography" className="absolute inset-0 h-full w-full object-cover opacity-45"/><video className="hero-video absolute inset-0 h-full w-full object-cover opacity-45" autoPlay={!prefersReducedMotion} muted loop={!prefersReducedMotion} controls={prefersReducedMotion} playsInline preload="metadata" poster={photoUrl} aria-hidden="true"><source src="https://videos.pexels.com/video-files/27641728/12192259_1080_1920_30fps.mp4" type="video/mp4"/></video>
        <div className="absolute inset-0 bg-gradient-to-r from-[#172c21]/90 via-[#172c21]/55 to-transparent"/>
        <div className="relative z-10 max-w-xl p-7 sm:p-10 lg:p-12"><span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs"><Clock3 size={14}/> Open daily · 9 AM–9 PM</span><h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">Hot from the kitchen.<br/><span className="text-[#ffbd79]">Ready for your table.</span></h1><p className="mt-4 max-w-md text-sm leading-6 text-white/80">Find Nigerian favourites, check the listed prices, and build your basket.</p><button onClick={() => onBrowse()} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#e96d2c] px-5 py-3 text-sm font-bold hover:bg-[#d65b1d]">Browse the menu <ArrowRight size={17}/></button><p className="mt-4 text-[11px] text-white/70">Illustrative media: <a href="https://unsplash.com/photos/a-table-topped-with-plates-of-food-and-a-bowl-of-rice-icciS_O3Gkk" target="_blank" rel="noreferrer" className="underline underline-offset-2">photo by Chibuzo Nwaneri / Unsplash</a> · <a href="https://www.pexels.com/video/a-person-is-cooking-food-on-a-grill-27641728/" target="_blank" rel="noreferrer" className="underline underline-offset-2">video by Kuiyibo Campos / Pexels</a></p></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <div className="flex flex-col justify-between rounded-3xl bg-[#f2dfbf] p-6"><span className="grid h-11 w-11 place-items-center rounded-xl bg-white/75 text-[#e96d2c]"><Truck size={21}/></span><div><p className="text-xs font-bold uppercase tracking-wider text-[#6b604f]">Delivery</p><h2 className="mt-2 text-2xl font-bold">Lagos only</h2><p className="mt-2 text-sm text-[#625849]">₦3,000 minimum. Fee varies by distance.</p><Link href="/delivery" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#b64a1a]">Delivery details <ArrowRight size={15}/></Link></div></div>
        <div className="flex flex-col justify-between rounded-3xl bg-[#e8eee6] p-6"><span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-[#315541]"><MessageCircle size={21}/></span><div><p className="text-xs font-bold uppercase tracking-wider text-[#5e7264]">Need a hand?</p><h2 className="mt-2 text-2xl font-bold">Ask the kitchen</h2><p className="mt-2 text-sm text-[#52645a]">Get answers from restaurant information and the assistant.</p><Link href="/assistant" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#315541]">Open assistant <ArrowRight size={15}/></Link></div></div>
      </div>
    </section>
    <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-[#e96d2c]">Find your favourite</p><h2 className="mt-2 text-2xl font-bold sm:text-3xl">Browse by category</h2></div><Link href="/menu" className="text-sm font-semibold text-[#b64a1a]">All menu <ArrowRight className="ml-1 inline" size={15}/></Link></div><div className="mt-5 flex gap-3 overflow-x-auto pb-2">{quickCategories.map((category, index) => <button key={category} onClick={() => onBrowse(category)} className="min-w-32 rounded-2xl border border-[#e8e2d6] bg-white px-4 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#e96d2c]"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#fff0e5] text-[#e96d2c]"><Utensils size={17}/></span><span className="mt-3 block text-sm font-semibold">{category}</span></button>)}</div></section>
    <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6"><div className="flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-[#e96d2c]">Straight from the menu</p><h2 className="mt-2 text-2xl font-bold sm:text-3xl">Popular picks</h2></div><span className="text-xs text-[#69766e]">{basketCount} in your basket</span></div><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{featured.map((item) => <ProductCard key={item.id} item={item} onAdd={() => onAdd(item)}/>)}</div><Link href="/menu" className="mx-auto mt-7 flex w-fit items-center gap-2 rounded-xl border border-[#d9d4c9] px-5 py-3 text-sm font-semibold hover:border-[#e96d2c]">See the full menu <ArrowRight size={16}/></Link></section>
  </main>;
}

function ProductCard({ item, onAdd }: { item: CatalogItem; onAdd: () => void }) {
  return <article className="flex min-h-40 flex-col justify-between rounded-2xl border border-[#e8e2d6] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div><span className="text-[10px] font-semibold uppercase tracking-wider text-[#7b887f]">{item.category}</span><h3 className="mt-2 font-bold leading-snug">{item.name}</h3></div><div className="mt-5 flex items-center justify-between"><strong className="text-sm">{item.price === null ? 'Ask for price' : money(item.price)}</strong>{item.price !== null && <button onClick={onAdd} aria-label={`Add ${item.name}`} className="grid h-9 w-9 place-items-center rounded-xl bg-[#e96d2c] text-white hover:bg-[#d65b1d]"><Plus size={18}/></button>}</div></article>;
}

function MenuPage({ search, setSearch, add, basket }: { search: string; setSearch: (value: string) => void; add: (item: CatalogItem) => void; basket: BasketLine[] }) {
  const [active, setActive] = useState('All');
  const categoriesWithAll = ['All', ...categories];
  const filtered = catalog.filter((item) => (active === 'All' || item.category === active) && `${item.name} ${item.category}`.toLowerCase().includes(search.toLowerCase()));
  return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-[#e96d2c]">Damien's Smoky Kitchen</p><h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">The menu</h1><p className="mt-2 text-sm text-[#69766e]">Prices shown are from the restaurant's menu information.</p></div><div className="rounded-xl bg-[#e8eee6] px-4 py-3 text-xs font-semibold">Minimum delivery order <strong className="ml-1">₦3,000</strong></div></div>
    <div className="mt-6 flex gap-2 overflow-x-auto pb-2">{categoriesWithAll.map((category) => <button key={category} onClick={() => setActive(category)} className={active === category ? 'shrink-0 rounded-full bg-[#21382d] px-4 py-2.5 text-xs font-bold text-white' : 'shrink-0 rounded-full border border-[#ded9ce] bg-white px-4 py-2.5 text-xs font-semibold hover:border-[#e96d2c]'}>{category}</button>)}</div>
    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((item) => <article key={item.id} className="flex items-center justify-between gap-4 rounded-2xl border border-[#e8e2d6] bg-white p-4"><div className="min-w-0"><span className="text-[10px] font-semibold uppercase tracking-wider text-[#7b887f]">{item.category}</span><h2 className="mt-1 font-bold">{item.name}</h2><p className="mt-1 text-sm font-semibold">{item.price === null ? 'Price not listed' : money(item.price)}</p></div>{item.price !== null && <button onClick={() => add(item)} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#e96d2c] px-3 py-2.5 text-xs font-bold text-white hover:bg-[#d65b1d]"><Plus size={15}/> Add</button>}</article>)}</div>
    {filtered.length === 0 && <p className="rounded-2xl bg-white p-8 text-center text-sm text-[#69766e]">No menu items match that search.</p>}
    <aside className="fixed bottom-4 left-1/2 z-30 flex w-[min(92vw,560px)] -translate-x-1/2 items-center justify-between rounded-2xl bg-[#21382d] px-5 py-4 text-white shadow-xl"><span className="text-sm font-semibold">{basket.reduce((sum, line) => sum + line.quantity, 0)} items in basket</span><Link href="/checkout" className="inline-flex items-center gap-2 rounded-xl bg-[#e96d2c] px-4 py-2.5 text-sm font-bold">Review basket <ArrowRight size={16}/></Link></aside>
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
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [confirmation, setConfirmation] = useState<{ orderId: string; message: string } | null>(null);
  const submitOrder = async (event: FormEvent) => {
    event.preventDefault();
    if (!basket.length || busy) return;
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
  return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6"><div><p className="text-xs font-bold uppercase tracking-widest text-[#e96d2c]">Your basket</p><h1 className="mt-2 text-3xl font-extrabold">Review your order</h1><p className="mt-2 text-sm text-[#69766e]">Your order request is saved securely. The restaurant must confirm availability and the delivery fee. No online payment is taken.</p></div><div className="mt-7 grid gap-8 lg:grid-cols-[1.1fr_.9fr]"><section className="space-y-3">{basket.map(({ item, quantity }) => <article key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[#e8e2d6] bg-white p-4"><div><h2 className="font-bold">{item.name}</h2><p className="mt-1 text-xs text-[#69766e]">{item.category} · {money(item.price ?? 0)} each</p></div><div className="flex items-center gap-2"><button onClick={() => change(item.id, -1)} className="grid h-8 w-8 place-items-center rounded-lg border" aria-label={`Remove one ${item.name}`}><Minus size={14}/></button><span className="w-5 text-center text-sm font-semibold">{quantity}</span><button onClick={() => change(item.id, 1)} className="grid h-8 w-8 place-items-center rounded-lg border" aria-label={`Add one ${item.name}`}><Plus size={14}/></button><button onClick={() => remove(item.id)} className="ml-1 text-[#8a6254]" aria-label={`Remove ${item.name}`}><Trash2 size={16}/></button></div></article>)}<button onClick={clear} className="text-xs font-semibold text-[#8a6254]">Clear basket</button><div className="rounded-2xl bg-[#e8eee6] p-4 text-sm"><strong>Delivery fee:</strong> depends on distance and is not included in this subtotal. The restaurant must confirm it.</div></section><section className="rounded-3xl border border-[#e8e2d6] bg-white p-5 sm:p-7"><div className="flex justify-between border-b border-[#eee9df] pb-4"><span className="text-sm">Food subtotal</span><strong>{money(subtotal)}</strong></div><p className="py-4 text-xs leading-5 text-[#69766e]">Minimum delivery order: {money(restaurantKnowledge.minimumDeliveryOrder)}. Delivery is limited to Lagos State.</p>{!meetsMinimum && <p className="mb-4 rounded-xl bg-[#fff0e5] p-3 text-xs text-[#8b401d]">Add {money(restaurantKnowledge.minimumDeliveryOrder - subtotal)} more to meet the delivery minimum.</p>}<form onSubmit={submitOrder} className="space-y-3"><label className="block text-xs font-semibold">Your name<input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-xl bg-[#f0ece2] px-3 py-3 text-sm font-normal outline-none focus:ring-2 focus:ring-[#e96d2c]"/></label><label className="block text-xs font-semibold">Phone number<input required maxLength={24} value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1 w-full rounded-xl bg-[#f0ece2] px-3 py-3 text-sm font-normal outline-none focus:ring-2 focus:ring-[#e96d2c]"/></label><label className="block text-xs font-semibold">Delivery address in Lagos<input required maxLength={300} value={address} onChange={(event) => setAddress(event.target.value)} className="mt-1 w-full rounded-xl bg-[#f0ece2] px-3 py-3 text-sm font-normal outline-none focus:ring-2 focus:ring-[#e96d2c]"/></label><label className="flex items-start gap-2 text-xs leading-5 text-[#69766e]"><input type="checkbox" required checked={adultConfirmed} onChange={event => setAdultConfirmed(event.target.checked)} className="mt-1 accent-[#e96d2c]"/>I confirm I am 18 or older. If I am ordering for a child, I am the parent/legal guardian and I am providing my own contact and delivery details.</label><p className="text-xs leading-5 text-[#69766e]">We use these details to process your order request and arrange delivery. Read our <Link href="/privacy" className="font-semibold underline">Privacy Notice</Link> and <Link href="/terms" className="font-semibold underline">Ordering Terms</Link>.</p><button disabled={busy || !meetsMinimum} className="w-full rounded-xl bg-[#21382d] px-4 py-3.5 text-sm font-bold text-white hover:bg-[#315541] disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Saving order…' : 'Send order request'}</button>{status && <p role="status" className="rounded-xl bg-[#e8eee6] p-3 text-xs leading-5">{status}</p>}</form></section></div></main>;
}


function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <main className="mx-auto max-w-md px-4 py-12 sm:py-16"><section className="rounded-3xl border border-[#e8e2d6] bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#e96d2c]">Damien's Smoky Kitchen</p><h1 className="mt-3 text-3xl font-extrabold">{title}</h1><p className="mt-2 text-sm leading-6 text-[#69766e]">{subtitle}</p>{children}</section></main>;
}

function CustomerAuthPage({ mode }: { mode: "register" | "login" }) {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [authEnabled, setAuthEnabled] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const register = mode === "register";
  useEffect(() => {
    let active = true;
    fetch("/api/auth/status", { cache: "no-store" }).then(response => response.json()).then(result => {
      if (active) setAuthEnabled(result.customerEnabled === true);
    }).catch(() => { if (active) setAuthEnabled(false); }).finally(() => { if (active) setStatusLoading(false); });
    return () => { active = false; };
  }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !authEnabled) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(register ? "/api/auth/register" : "/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(register ? { name, email, phone, password, adultConfirmed } : { email, password }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "We could not complete your request.");
      setLocation("/account");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not complete your request.");
    } finally { setBusy(false); }
  };
  return <AuthShell title={register ? "Create your account" : "Welcome back"} subtitle={register ? "Save your details for a simpler ordering experience." : "Log in to access your customer account."}>
    {statusLoading ? <p className="mt-6 text-sm text-[#69766e]">Checking account availability…</p> : !authEnabled ? <div className="mt-6 rounded-2xl bg-[#e8eee6] p-4 text-sm leading-6 text-[#52645a]"><strong className="block text-[#21382d]">Customer accounts are not enabled yet.</strong><span className="mt-2 block">We are completing the secure sign-in and email-verification setup. You can still browse the menu and submit a guest order without creating an account.</span><Link href="/menu" className="mt-4 inline-flex font-bold text-[#b64a1a] underline">Continue as a guest</Link></div> : <>
      <form onSubmit={submit} className="mt-7 space-y-4">
        {register && <label className="block text-xs font-semibold">Full name<input required autoComplete="name" maxLength={100} value={name} onChange={e => setName(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[#e5dfd3] bg-[#fbf8f1] px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#e96d2c]"/></label>}
        {register && <label className="flex items-start gap-2 text-xs leading-5 text-[#69766e]"><input type="checkbox" required checked={adultConfirmed} onChange={e => setAdultConfirmed(e.target.checked)} className="mt-1 accent-[#e96d2c]"/>I confirm I am 18 or older and have read the <Link href="/privacy" className="font-semibold underline">Privacy Notice</Link>. A parent/legal guardian must create an account or place an order for a child using their own details.</label>}
        <label className="block text-xs font-semibold">Email address<input required type="email" autoComplete="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[#e5dfd3] bg-[#fbf8f1] px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#e96d2c]"/></label>
        {register && <label className="block text-xs font-semibold">Phone number<input required type="tel" autoComplete="tel" maxLength={24} value={phone} onChange={e => setPhone(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[#e5dfd3] bg-[#fbf8f1] px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#e96d2c]"/></label>}
        <label className="block text-xs font-semibold">Password<input required type="password" autoComplete={register ? "new-password" : "current-password"} minLength={12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[#e5dfd3] bg-[#fbf8f1] px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#e96d2c]"/><span className="mt-1 block text-[11px] font-normal text-[#7b887f]">Use at least 12 characters.</span></label>
        {error && <p role="alert" className="rounded-xl bg-[#fff0e5] p-3 text-xs leading-5 text-[#8b401d]">{error}</p>}
        <button disabled={busy} className="w-full rounded-xl bg-[#21382d] px-4 py-3.5 text-sm font-bold text-white hover:bg-[#315541] disabled:opacity-60">{busy ? "Please wait…" : register ? "Create account" : "Log in"}</button>
      </form>
      <p className="mt-6 text-center text-xs text-[#69766e]">{register ? "Already have an account?" : "New to Damien's Smoky Kitchen?"} <Link href={register ? "/login" : "/create-account"} className="font-bold text-[#b64a1a]">{register ? "Log in" : "Create account"}</Link></p>
    </>}
    <p className="mt-3 text-center text-xs"><Link href="/staff-login" className="text-[#69766e] underline underline-offset-4">Staff login</Link></p>
  </AuthShell>;
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
  return <AuthShell title="Staff sign in" subtitle="Private access for authorised restaurant staff. A six-digit authenticator code is required in addition to your password.">
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
  const [user, setUser] = useState<{ name: string; email: string; phone: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletePassword, setDeletePassword] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { credentials: "same-origin" }).then(async response => {
      if (!response.ok) throw new Error("Please log in to view your account.");
      const result = await response.json();
      if (result.role !== "customer") throw new Error("This page is for customer accounts.");
      if (active) setUser(result.user);
    }).catch(() => { if (active) setLocation("/login"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [setLocation]);
  const logout = async () => { await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }); setLocation("/login"); };
  const deleteAccount = async () => {
    if (busy || !deletePassword) return;
    if (!window.confirm("Permanently delete your customer account? This cannot be undone. Order records may be retained where required by law.")) return;
    setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/auth/delete-account", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ password: deletePassword }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "We could not delete your account.");
      setLocation("/");
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "We could not delete your account.");
    } finally { setBusy(false); }
  };
  return <AuthShell title="Your account" subtitle="Your customer profile. Order history will be connected in a later stage.">
    {loading ? <p className="mt-6 text-sm text-[#69766e]">Loading your account…</p> : user && <div className="mt-6 space-y-3 text-sm"><p><strong>Name:</strong> {user.name}</p><p><strong>Email:</strong> {user.email}</p><p><strong>Phone:</strong> {user.phone}</p><button onClick={logout} className="mt-4 w-full rounded-xl border border-[#d9d4c9] px-4 py-3 text-sm font-semibold">Log out</button><div className="mt-6 border-t border-[#e8e2d6] pt-5"><h2 className="font-bold text-[#8b401d]">Delete account</h2><p className="mt-2 text-xs leading-5 text-[#69766e]">Enter your password to delete your account and sign out all sessions. Transaction records may be retained where the law requires them.</p><input type="password" autoComplete="current-password" minLength={12} maxLength={128} value={deletePassword} onChange={event => setDeletePassword(event.target.value)} placeholder="Current password" className="mt-3 w-full rounded-xl border border-[#e5dfd3] bg-[#fbf8f1] px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#e96d2c]"/><button type="button" disabled={busy || !deletePassword} onClick={deleteAccount} className="mt-3 w-full rounded-xl border border-[#b64a1a] px-4 py-3 text-sm font-bold text-[#b64a1a] disabled:opacity-50">{busy ? "Deleting…" : "Permanently delete account"}</button>{status && <p role="alert" className="mt-3 rounded-xl bg-[#fff0e5] p-3 text-xs">{status}</p>}</div></div>}
  </AuthShell>;
}

function StaffPortalPage() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { credentials: "same-origin" }).then(async response => {
      if (!response.ok) throw new Error("Staff login required.");
      const result = await response.json();
      if (result.role !== "staff") throw new Error("Staff access required.");
      if (active) setEmail(result.user.email);
    }).catch(() => { if (active) setLocation("/staff-login"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [setLocation]);
  const logout = async () => { await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }); setLocation("/staff-login"); };
  return <AuthShell title="Staff portal" subtitle="Private staff identity check. Order management will be added after this authentication layer is verified.">
    {loading ? <p className="mt-6 text-sm text-[#69766e]">Verifying staff session…</p> : email && <div className="mt-6 space-y-4"><p className="text-sm">Signed in as <strong>{email}</strong>.</p><p className="rounded-xl bg-[#e8eee6] p-3 text-xs leading-5">Your staff session is active. Customer account permissions are separate.</p><button onClick={logout} className="w-full rounded-xl border border-[#d9d4c9] px-4 py-3 text-sm font-semibold">Log out</button></div>}
  </AuthShell>;
}

function NotFound() {
  return <main className="mx-auto max-w-2xl px-4 py-24 text-center"><h1 className="text-3xl font-extrabold">Page not found</h1><Link href="/" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#b64a1a]">Back home <ArrowRight size={16}/></Link></main>;
}

export default App;
