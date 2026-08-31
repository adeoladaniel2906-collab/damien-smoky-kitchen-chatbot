import { type FormEvent, type ReactNode, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ArrowDownRight, ArrowUpRight, CalendarDays, Check, ChevronDown, Clock3, Flame, Instagram, MapPin, Menu as MenuIcon, MessageCircle, Minus, Phone, Plus, Send, Sparkles, X } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import heroImage from '../attached_assets/generated_images/hero-jollof-fire.jpg';
import familyImage from '../attached_assets/generated_images/family-kitchen.jpg';
import { getChatbotReply } from './script.js';

const queryClient = new QueryClient();

type MenuItem = { name: string; description: string; price: string; label?: string; image?: string };

const menu: Record<string, MenuItem[]> = {
  "From the fire": [
    { name: "Smoky jollof", description: "Long-grain rice, tomato pepper base, charred vegetables, fried plantain.", price: "$18", label: "House signature" },
    { name: "Suya skewers", description: "Peanut-spiced beef, onions, cucumber, our ginger-lime sauce.", price: "$16", label: "A little heat" },
    { name: "Pepper prawns", description: "Head-on prawns, roasted ata rodo, garlic, scent leaf.", price: "$24" },
    { name: "Charcoal chicken", description: "Half bird, smoky pepper rub, green herb salad, warm bread.", price: "$22" },
  ],
  "Bowls & plates": [
    { name: "Egusi & pounded yam", description: "Ground melon seed stew, spinach, smoked fish, soft yam.", price: "$21", label: "Family recipe" },
    { name: "Efo riro", description: "Greens, red peppers, slow-braised beef, rice or pounded yam.", price: "$19" },
    { name: "Black-eyed bean bowl", description: "Creamy beans, avocado, sweet plantain, crunchy pepper relish.", price: "$17", label: "Plant-forward" },
    { name: "Oxtail pepper soup", description: "Slow-cooked oxtail, fresh herbs, warming peppers, cassava.", price: "$23" },
  ],
  "Little plates": [
    { name: "Dundun plantain", description: "Ripe plantain, sea salt, smoked chili honey.", price: "$9" },
    { name: "Puff puff", description: "Warm Nigerian doughnuts, cardamom sugar, ginger cream.", price: "$8" },
    { name: "Chin chin", description: "Buttery, crisp, spiced bites for the table.", price: "$6" },
    { name: "Pepper soup broth", description: "A small cup of fragrant broth and fresh herbs.", price: "$7" },
  ],
};

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function Nav({ onBook }: { onBook: () => void }) {
  const [open, setOpen] = useState(false);
  const links = [
    { label: "Menu", target: "menu" },
    { label: "Our table", target: "story" },
    { label: "Visit", target: "visit" },
  ];
  return (
    <header className="absolute left-0 right-0 top-0 z-20 border-b border-[#f6f0e5]/20 text-[#f6f0e5]">
      <div className="mx-auto flex max-w-[1320px] items-center justify-between px-5 py-5 md:px-10">
        <button onClick={() => scrollToId("top")} className="group flex items-center gap-3 text-left" data-testid="button-home">
          <span className="grid h-10 w-10 place-items-center border border-[#e5603e] text-[#e5603e]"><Flame size={20} strokeWidth={1.7} /></span>
          <span><span className="display block text-lg leading-none">Damien's</span><span className="mono block text-[9px] uppercase tracking-[.22em] text-[#e5c99a]">Smoky Kitchen</span></span>
        </button>
        <nav className="hidden items-center gap-9 md:flex">
          {links.map((link) => <button key={link.target} onClick={() => scrollToId(link.target)} className="site-link mono text-[10px] uppercase text-[#f6f0e5]/80 transition-colors hover:text-[#e5c99a]" data-testid={`link-${link.target}`}>{link.label}</button>)}
          <button onClick={onBook} className="border border-[#e5c99a] px-5 py-3 mono text-[10px] uppercase text-[#e5c99a] transition-colors hover:bg-[#e5c99a] hover:text-[#36241d]" data-testid="button-nav-reserve">Reserve a table</button>
        </nav>
        <button onClick={() => setOpen(!open)} className="grid h-10 w-10 place-items-center border border-[#f6f0e5]/35 md:hidden" data-testid="button-mobile-menu" aria-label="Toggle menu">{open ? <X size={19} /> : <MenuIcon size={19} />}</button>
      </div>
      {open && <div className="border-t border-[#f6f0e5]/20 bg-[#36241d] px-5 py-5 md:hidden">
        {links.map((link) => <button key={link.target} onClick={() => { setOpen(false); scrollToId(link.target); }} className="mono block w-full border-b border-[#f6f0e5]/15 py-3 text-left text-[11px] uppercase text-[#f6f0e5]" data-testid={`link-mobile-${link.target}`}>{link.label}</button>)}
        <button onClick={() => { setOpen(false); onBook(); }} className="mt-4 w-full bg-[#e5603e] px-4 py-3 mono text-[10px] uppercase text-[#f6f0e5]" data-testid="button-mobile-reserve">Reserve a table</button>
      </div>}
    </header>
  );
}

function ReservationModal({ onClose }: { onClose: () => void }) {
  const [sent, setSent] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSent(true); }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#22150f]/75 px-5" role="dialog" aria-modal="true">
    <div className="relative w-full max-w-lg bg-[#f6f0e5] p-7 text-[#36241d] shadow-2xl md:p-10">
      <button onClick={onClose} className="absolute right-5 top-5 text-[#36241d]/60 hover:text-[#e5603e]" data-testid="button-close-reservation" aria-label="Close reservation form"><X size={20} /></button>
      {!sent ? <><p className="mono mb-3 text-[10px] uppercase tracking-[.2em] text-[#e5603e]">Pull up a chair</p><h2 className="display text-4xl">Reserve your table.</h2><p className="mt-3 text-sm leading-6 text-[#36241d]/65">We keep a few tables for walk-ins, but reservations make a Friday night easier.</p>
        <form onSubmit={submit} className="mt-7 grid gap-4">
          <label className="grid gap-2"><span className="mono text-[10px] uppercase">Your name</span><input required className="border-b border-[#36241d]/25 bg-transparent px-0 py-2 outline-none focus:border-[#e5603e]" data-testid="input-reservation-name" /></label>
          <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2"><span className="mono text-[10px] uppercase">Date</span><input type="date" required className="border-b border-[#36241d]/25 bg-transparent px-0 py-2 outline-none focus:border-[#e5603e]" data-testid="input-reservation-date" /></label><label className="grid gap-2"><span className="mono text-[10px] uppercase">Party</span><select className="border-b border-[#36241d]/25 bg-transparent px-0 py-2 outline-none" data-testid="select-reservation-party"><option>2 people</option><option>3 people</option><option>4 people</option><option>5+ people</option></select></label></div>
          <label className="grid gap-2"><span className="mono text-[10px] uppercase">A note for the kitchen <span className="opacity-50">(optional)</span></span><textarea rows={2} className="resize-none border-b border-[#36241d]/25 bg-transparent px-0 py-2 outline-none focus:border-[#e5603e]" data-testid="textarea-reservation-note" /></label>
          <button type="submit" className="mt-3 bg-[#e5603e] px-5 py-4 mono text-[10px] uppercase tracking-[.12em] text-[#f6f0e5] transition-colors hover:bg-[#bd452d]" data-testid="button-submit-reservation">Request reservation <ArrowUpRight className="ml-2 inline" size={15} /></button>
        </form></> : <div className="py-12 text-center"><span className="mx-auto grid h-14 w-14 place-items-center border border-[#e5603e] text-[#e5603e]"><Check size={25} /></span><h2 className="display mt-5 text-4xl">You're on the list.</h2><p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-[#36241d]/65">We'll send a confirmation to your phone shortly. See you around the fire.</p><button onClick={onClose} className="mt-7 border border-[#36241d] px-5 py-3 mono text-[10px] uppercase" data-testid="button-close-confirmation">Done</button></div>}
    </div>
  </div>;
}

function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([{ from: "assistant", text: "Hello from the kitchen. What can I help you find?" }]);
  const suggestions = [{ label: "Menu & prices", key: "menu" }, { label: "When are you open?", key: "hours" }, { label: "Where are you located?", key: "location" }];
  function reply(question: string) {
    setMessages((current) => [...current, { from: "user", text: question }, { from: "assistant", text: getChatbotReply(question) }]);
  }
  function send(event: FormEvent) { event.preventDefault(); if (!input.trim()) return; reply(input.trim()); setInput(""); }
  return <div className="fixed bottom-5 right-5 z-40 md:bottom-8 md:right-8">
    {isOpen && <div className="mb-3 w-[min(360px,calc(100vw-40px))] border border-[#f6f0e5]/20 bg-[#36241d] text-[#f6f0e5] shadow-2xl">
      <div className="flex items-center justify-between border-b border-[#f6f0e5]/15 px-5 py-4"><div><p className="mono text-[9px] uppercase tracking-[.18em] text-[#e5c99a]">Kitchen assistant</p><p className="mt-1 text-sm">Local answers, no fuss.</p></div><span className="pulse-soft h-2 w-2 bg-[#e5603e]" /></div>
      <div className="max-h-72 space-y-3 overflow-y-auto p-4">{messages.map((message, index) => <div key={`${message.from}-${index}`} className={`flex ${message.from === "user" ? "justify-end" : "justify-start"}`}><p className={`max-w-[88%] px-3 py-2 text-xs leading-5 ${message.from === "user" ? "bg-[#e5603e] text-[#f6f0e5]" : "bg-[#4a3328] text-[#f6f0e5]/85"}`} data-testid={`text-chat-message-${index}`}>{message.text}</p></div>)}</div>
      {messages.length === 1 && <div className="flex flex-wrap gap-2 px-4 pb-3">{suggestions.map((suggestion) => <button key={suggestion.key} onClick={() => reply(suggestion.label)} className="border border-[#f6f0e5]/25 px-2 py-2 text-[10px] text-[#f6f0e5]/80 hover:border-[#e5c99a] hover:text-[#e5c99a]" data-testid={`button-chat-${suggestion.key}`}>{suggestion.label}</button>)}</div>}
      <form onSubmit={send} className="flex border-t border-[#f6f0e5]/15"><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask the kitchen..." className="min-w-0 flex-1 bg-transparent px-4 py-3 text-xs outline-none placeholder:text-[#f6f0e5]/40" data-testid="input-chat" /><button className="px-4 text-[#e5c99a] hover:text-[#e5603e]" data-testid="button-send-chat" aria-label="Send message"><Send size={16} /></button></form>
    </div>}
    <button onClick={() => setIsOpen(!isOpen)} className="ml-auto flex items-center gap-3 bg-[#e5603e] px-4 py-3 text-[#f6f0e5] shadow-lg transition-transform hover:-translate-y-1" data-testid="button-open-chat"><MessageCircle size={18} /><span className="mono text-[10px] uppercase">{isOpen ? "Close chat" : "Ask Damien"}</span></button>
  </div>;
}

function Home() {
  const [activeCategory, setActiveCategory] = useState("From the fire");
  const [reservationOpen, setReservationOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const menuItems = useMemo(() => menu[activeCategory], [activeCategory]);
  return <main id="top" className="grain min-h-[100dvh] overflow-hidden bg-[#eee9df]">
    <section className="relative min-h-[720px] bg-[#36241d] text-[#f6f0e5] md:min-h-[780px]">
      <Nav onBook={() => setReservationOpen(true)} />
      <div className="mx-auto grid max-w-[1320px] items-end gap-10 px-5 pb-16 pt-36 md:grid-cols-[1fr_1.1fr] md:px-10 md:pb-24 md:pt-44">
        <div className="relative z-10">
          <p className="reveal mono mb-6 flex items-center gap-3 text-[10px] uppercase tracking-[.24em] text-[#e5c99a]"><span className="h-px w-10 bg-[#e5603e]" /> West Oakland · Est. 2018</p>
          <h1 className="reveal-delay display max-w-2xl text-[clamp(4rem,9vw,8.5rem)] leading-[.84] tracking-[-.065em]">Come for<br /><span className="text-[#e5603e]">the smoke.</span></h1>
          <p className="reveal-delay-2 mt-8 max-w-md text-base font-light leading-7 text-[#f6f0e5]/70 md:text-lg">Stay for the stories, the second helping, and the pepper that sneaks up on you.</p>
          <div className="reveal-delay-2 mt-10 flex flex-wrap items-center gap-4"><button onClick={() => scrollToId("menu")} className="bg-[#e5603e] px-6 py-4 mono text-[10px] uppercase tracking-[.15em] transition-colors hover:bg-[#bd452d]" data-testid="button-hero-menu">See what's cooking <ArrowDownRight className="ml-2 inline" size={15} /></button><button onClick={() => setReservationOpen(true)} className="border border-[#f6f0e5]/40 px-6 py-4 mono text-[10px] uppercase tracking-[.15em] transition-colors hover:border-[#e5c99a] hover:text-[#e5c99a]" data-testid="button-hero-reserve">Book a table</button></div>
        </div>
        <div className="relative mt-5 md:mt-0"><div className="absolute -left-4 -top-4 z-10 h-20 w-20 border-l border-t border-[#e5c99a]/60" /><img src={heroImage} alt="Smoky jollof rice and grilled suya on a ceramic platter" className="h-[380px] w-full object-cover md:h-[520px]" /><div className="absolute bottom-5 left-5 bg-[#36241d]/90 px-4 py-3 backdrop-blur-sm"><p className="mono text-[9px] uppercase tracking-[.18em] text-[#e5c99a]">Tonight's mood</p><p className="mt-1 text-sm">Low lights. Full plates.</p></div></div>
      </div>
      <div className="absolute bottom-6 right-10 hidden items-center gap-3 md:flex"><span className="mono text-[9px] uppercase tracking-[.2em] text-[#f6f0e5]/45">Scroll to eat</span><ArrowDownRight size={16} className="text-[#e5603e]" /></div>
    </section>

    <section className="border-b border-[#36241d]/15 bg-[#e5c99a] px-5 py-5 md:px-10"><div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-4"><p className="display text-xl md:text-2xl">Good food doesn't need a special occasion.</p><p className="mono text-[10px] uppercase tracking-[.18em] text-[#36241d]/65">Tuesday–Sunday · Walk-ins welcome</p></div></section>

    <section id="menu" className="mx-auto max-w-[1320px] scroll-mt-5 px-5 py-20 md:px-10 md:py-32">
      <div className="grid gap-10 md:grid-cols-[.75fr_1.5fr] md:gap-24"><div><p className="mono text-[10px] uppercase tracking-[.22em] text-[#e5603e]">01 / The menu</p><h2 className="display mt-5 text-6xl leading-[.88] tracking-[-.05em] md:text-8xl">Built by<br /><span className="text-[#e5603e]">the fire.</span></h2><p className="mt-7 max-w-xs text-sm leading-6 text-[#36241d]/65">Our menu moves with the market and the mood. Every plate begins with smoke, spice, and something worth passing across the table.</p><div className="mt-10 hidden border-l border-[#e5603e] pl-4 md:block"><p className="display text-2xl">“The kind of food that makes a quiet table loud.”</p><p className="mono mt-3 text-[9px] uppercase text-[#36241d]/50">— Oakland Magazine</p></div></div>
        <div><div className="mb-7 flex gap-5 overflow-x-auto border-b border-[#36241d]/15">{Object.keys(menu).map((category) => <button key={category} onClick={() => { setActiveCategory(category); setExpanded(null); }} className={`shrink-0 pb-4 mono text-[10px] uppercase tracking-[.12em] transition-colors ${activeCategory === category ? "border-b-2 border-[#e5603e] text-[#e5603e]" : "text-[#36241d]/50 hover:text-[#36241d]"}`} data-testid={`button-menu-category-${category}`}>{category}</button>)}</div>
          <div>{menuItems.map((item, index) => <div key={item.name} className="group border-b border-[#36241d]/15 py-5 first:border-t"><button onClick={() => setExpanded(expanded === index ? null : index)} className="flex w-full items-start justify-between gap-5 text-left" data-testid={`button-menu-item-${item.name}`}><div><div className="flex flex-wrap items-center gap-3"><h3 className="display text-2xl md:text-3xl">{item.name}</h3>{item.label && <span className="border border-[#e5603e]/50 px-2 py-1 mono text-[8px] uppercase tracking-[.1em] text-[#e5603e]">{item.label}</span>}</div><p className={`mt-2 max-w-lg text-sm leading-6 text-[#36241d]/60 transition-all ${expanded === index ? "max-h-20 opacity-100" : "max-h-0 overflow-hidden opacity-0 md:max-h-20 md:opacity-100"}`}>{item.description}</p></div><span className="mt-1 text-[#e5603e]">{expanded === index ? <Minus size={17} /> : <Plus size={17} />}</span></button></div>)}</div>
          <button onClick={() => setReservationOpen(true)} className="mt-9 border-b border-[#36241d] pb-2 mono text-[10px] uppercase tracking-[.14em] hover:border-[#e5603e] hover:text-[#e5603e]" data-testid="button-menu-reserve">Come hungry, reserve a table <ArrowUpRight className="ml-2 inline" size={14} /></button>
        </div></div>
    </section>

    <section id="story" className="scroll-mt-5 bg-[#36241d] text-[#f6f0e5]"><div className="mx-auto grid max-w-[1320px] md:grid-cols-[1.05fr_1fr]"><div className="relative min-h-[440px] md:min-h-[620px]"><img src={familyImage} alt="Hands preparing peppers beside a charcoal grill in a family kitchen" className="absolute inset-0 h-full w-full object-cover opacity-85" /><div className="absolute inset-0 bg-gradient-to-t from-[#36241d]/70 to-transparent" /><div className="absolute bottom-7 left-5 md:bottom-10 md:left-10"><p className="mono text-[9px] uppercase tracking-[.2em] text-[#e5c99a]">A kitchen, not a concept</p><p className="mt-2 text-sm text-[#f6f0e5]/75">Pepper on the cutting board since 1979.</p></div></div><div className="flex flex-col justify-center px-5 py-16 md:px-16 md:py-24"><p className="mono text-[10px] uppercase tracking-[.22em] text-[#e5603e]">02 / Our table</p><h2 className="display mt-5 text-5xl leading-[.93] tracking-[-.04em] md:text-7xl">A little Lagos.<br /><span className="text-[#e5c99a]">A lot of Oakland.</span></h2><p className="mt-8 max-w-md text-base font-light leading-7 text-[#f6f0e5]/70">Damien learned to cook by standing on a milk crate in his auntie’s kitchen, watching onions soften and listening for the exact moment the pepper became sweet. Years later, the recipe is still in his hands — just with more seats at the table.</p><p className="mt-5 max-w-md text-base font-light leading-7 text-[#f6f0e5]/70">We cook Nigerian food the way our families do: generously, loudly, and with no interest in making you feel like a stranger.</p><button onClick={() => setReservationOpen(true)} className="mt-10 self-start border-b border-[#e5c99a] pb-2 mono text-[10px] uppercase tracking-[.15em] text-[#e5c99a] hover:text-[#e5603e]" data-testid="button-story-reserve">Pull up a chair <ArrowUpRight className="ml-2 inline" size={14} /></button></div></div></section>

    <section className="bg-[#e5603e] px-5 py-16 text-[#f6f0e5] md:px-10 md:py-20"><div className="mx-auto grid max-w-[1320px] gap-8 md:grid-cols-[1fr_auto] md:items-end"><div><p className="mono text-[10px] uppercase tracking-[.22em] text-[#f6f0e5]/70">03 / The Damien's rule</p><h2 className="display mt-4 max-w-3xl text-5xl leading-[.9] tracking-[-.04em] md:text-7xl">If there isn't enough<br />for the table, start again.</h2></div><p className="max-w-xs text-sm leading-6 text-[#f6f0e5]/80">There is always more rice. There is always time for one more story. There is never a wrong way to ask for extra sauce.</p></div></section>

    <section id="visit" className="scroll-mt-5 px-5 py-20 md:px-10 md:py-28"><div className="mx-auto max-w-[1320px]"><div className="grid gap-14 md:grid-cols-[1fr_.9fr]"><div><p className="mono text-[10px] uppercase tracking-[.22em] text-[#e5603e]">04 / Come through</p><h2 className="display mt-5 text-6xl leading-[.86] tracking-[-.05em] md:text-8xl">See you<br /><span className="text-[#e5603e]">tonight?</span></h2><div className="mt-10 grid max-w-lg gap-5 border-t border-[#36241d]/15 pt-6 sm:grid-cols-2"><div><div className="flex items-center gap-2 text-[#e5603e]"><MapPin size={16} /><span className="mono text-[10px] uppercase">Address</span></div><p className="mt-2 text-sm leading-6">1842 San Pablo Avenue<br />West Oakland, CA 94612</p></div><div><div className="flex items-center gap-2 text-[#e5603e]"><Clock3 size={16} /><span className="mono text-[10px] uppercase">Hours</span></div><p className="mt-2 text-sm leading-6">Tue–Thu 5–10pm<br />Fri–Sat 5–11pm · Sun 11am–4pm</p></div></div><div className="mt-8 flex flex-wrap gap-4"><button onClick={() => setReservationOpen(true)} className="bg-[#36241d] px-6 py-4 mono text-[10px] uppercase tracking-[.14em] text-[#f6f0e5] hover:bg-[#e5603e]" data-testid="button-visit-reserve">Reserve a table</button><a href="tel:+15105550184" className="flex items-center gap-2 border border-[#36241d]/35 px-5 py-4 mono text-[10px] uppercase tracking-[.14em] hover:border-[#e5603e] hover:text-[#e5603e]" data-testid="link-call"><Phone size={14} /> (510) 555-0184</a></div></div><div className="bg-[#e5c99a] p-7 md:p-10"><div className="flex items-center justify-between"><CalendarDays className="text-[#e5603e]" size={25} strokeWidth={1.5} /><span className="mono text-[10px] uppercase tracking-[.2em] text-[#36241d]/55">Good to know</span></div><h3 className="display mt-10 text-4xl leading-none">Walk-ins are<br />always welcome.</h3><ul className="mt-8 space-y-5 border-t border-[#36241d]/20 pt-6 text-sm leading-6"><li className="flex gap-3"><Check size={17} className="mt-1 shrink-0 text-[#e5603e]" />We hold a handful of tables for the spontaneous among us.</li><li className="flex gap-3"><Check size={17} className="mt-1 shrink-0 text-[#e5603e]" />Large groups: give us a call and we will make room.</li><li className="flex gap-3"><Check size={17} className="mt-1 shrink-0 text-[#e5603e]" />Takeout travels well. Ask about tonight’s family packs.</li></ul></div></div></div></section>

    <footer className="bg-[#36241d] px-5 py-10 text-[#f6f0e5] md:px-10"><div className="mx-auto flex max-w-[1320px] flex-col justify-between gap-8 md:flex-row md:items-end"><div><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center border border-[#e5603e] text-[#e5603e]"><Flame size={17} /></span><span className="display text-2xl">Damien's Smoky Kitchen</span></div><p className="mt-5 max-w-xs text-sm leading-6 text-[#f6f0e5]/55">Nigerian food, Oakland heart.<br />Come hungry. Leave looked after.</p></div><div className="flex items-end justify-between gap-10 md:gap-16"><div><p className="mono text-[9px] uppercase tracking-[.2em] text-[#e5c99a]">Follow the smoke</p><a href="https://instagram.com" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm hover:text-[#e5c99a]" data-testid="link-instagram"><Instagram size={16} /> @damiensmokykitchen</a></div><button onClick={() => scrollToId("top")} className="flex items-center gap-2 mono text-[9px] uppercase text-[#f6f0e5]/55 hover:text-[#e5c99a]" data-testid="button-back-top">Back to top <ArrowUpRight size={14} /></button></div></div><div className="mx-auto mt-10 max-w-[1320px] border-t border-[#f6f0e5]/15 pt-4 mono text-[9px] uppercase tracking-[.12em] text-[#f6f0e5]/35">© 2024 Damien's Smoky Kitchen · Made for sharing</div></footer>
    <ChatWidget />
    {reservationOpen && <ReservationModal onClose={() => setReservationOpen(false)} />}
  </main>;
}

function Router() {
  return <RoutedErrorBoundary><Switch><Route path="/" component={Home} /><Route component={NotFound} /></Switch></RoutedErrorBoundary>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;