/**
 * Offline replica of the fourseasons.com booking funnel, for testing the framework rather than the site.
 *
 * Reproduces what the live site showed on 2026-09-23: ARIA structure, data-tracking-id and data-cy hooks,
 * asynchronous calendar paging, a sold-out day, the cart count updating before the post-add redirect, the
 * OneTrust banner and the Qualtrics survey. Used to run the spec hermetically and to inject cart defects.
 *
 *   node tools/offline-site/server.mjs    # http://127.0.0.1:4173
 */
import { createServer } from 'node:http';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Cart defects the spec must catch, with the assertion expected to fail for each. A defect caught by a
 * different failure counts as missed.
 */
export const DEFECTS = Object.freeze({
  price: {
    description: 'nightly rate is CAD 5 higher than on the rate card',
    caughtBy: 'nightly rate in cart vs. rate card',
  },
  currency: {
    description: 'nightly rate is in another currency',
    caughtBy: 'nightly rate in cart vs. rate card',
  },
  room: { description: 'a different room is shown', caughtBy: 'room and bed type' },
  bed: { description: 'a different bed configuration is shown', caughtBy: 'room and bed type' },
  rate: { description: 'a different rate plan is shown', caughtBy: 'rate plan' },
  adults: { description: 'a different number of guests is shown', caughtBy: 'guests' },
  dates: { description: 'check-out is one day later than searched', caughtBy: 'stay dates' },
  count: { description: 'the room is in the cart twice', caughtBy: 'exactly one room in the cart' },
  untaxed: {
    description: 'estimated total leaves out service charge and taxes',
    caughtBy: 'estimated total includes the service charge',
  },
  undercharge: {
    description: 'estimated total is below the nightly rate',
    caughtBy: 'estimated total includes the service charge',
  },
  overcharge: {
    description: 'estimated total charges every night twice',
    caughtBy: 'estimated total is not inflated',
  },
});

const ROOMS = [
  {
    name: 'Ocean-View La Casona Room',
    beds: [
      { name: 'One king bed', price: 1448.81 },
      { name: 'Two queen beds', price: 1484.2 },
    ],
  },
  { name: 'Ocean-View Casita Suite', price: 2981.6 },
];
const RATES = [
  { name: 'Advance Purchase – Up to 20% Off', terms: 'Non-refundable', factor: 1 },
  { name: 'Room Rate', terms: 'Free Cancellation', factor: 1.17 },
];

const STYLE = `
  body { margin: 0; font: 14px/1.4 Arial, sans-serif; color: #111; }
  header { position: sticky; top: 0; z-index: 10; display: flex; justify-content: space-between;
           padding: 12px 24px; background: #000; color: #fff; }
  header button { background: none; border: 0; color: #fff; cursor: pointer; }
  main { padding: 24px 48px; }
  .hidden { display: none; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  [role=form] { position: relative; display: flex; gap: 12px; padding: 12px 0; border-bottom: 1px solid #ddd; }
  #datefield-id, #occupancyId { min-width: 220px; padding: 8px 12px; border: 1px solid #999; cursor: pointer; }
  .popup { position: absolute; top: 64px; left: 0; z-index: 5; padding: 12px; background: #fff;
           border: 1px solid #ccc; box-shadow: 0 4px 16px #0003; }
  .months { display: flex; gap: 24px; }
  .days { display: grid; grid-template-columns: repeat(7, 34px); gap: 2px; }
  .card { margin: 16px 0; padding: 12px; border: 1px solid #ddd; }
  .rate { display: flex; justify-content: space-between; padding: 8px 0; border-top: 1px solid #eee; }
  .rate-details { text-transform: uppercase; }
  .bed-option { text-transform: capitalize; }
  .uppercase { text-transform: uppercase; }
  #onetrust-banner-sdk { position: fixed; inset: auto 0 0 0; z-index: 1000; display: flex; gap: 24px;
                         align-items: center; justify-content: center; height: 140px; background: #f4f4f4; }
  [aria-label="User Panel"] { position: fixed; inset: 0 0 0 auto; z-index: 50; width: 420px; padding: 24px;
                              background: #fff; box-shadow: -4px 0 24px #0004; }
  .QSIPopOver { position: fixed; inset: 0; z-index: 2000000007; background: #0009; }
`;

// Browser-side helpers shared by every page.
const CLIENT_COMMON = String.raw`
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December'];
const DAY_MS = 86400000;
const pad = (n) => String(n).padStart(2, '0');
const todayUtc = () => { const d = new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); };
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const usDate = (t) => { const d = new Date(t); return pad(d.getUTCMonth() + 1) + '/' + pad(d.getUTCDate()) + '/' + d.getUTCFullYear(); };
const words = (t) => { const d = new Date(t); return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate() + ' ' + d.getUTCFullYear(); };
const longLabel = (t) => new Intl.DateTimeFormat('en-US',
  { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(t);
const cad = (value, decimals) => 'CAD ' + value.toLocaleString('en-US',
  { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
const readCart = () => JSON.parse(localStorage.getItem('offline-cart') || '[]');

function renderCartCount() {
  const count = readCart().length;
  document.querySelector('#shopping_cart_icon span').textContent = count ? 'Cart(' + count + ')' : 'Cart';
}

function showCookieBanner() {
  if (localStorage.getItem('offline-consent')) return;
  setTimeout(() => {
    const banner = document.createElement('div');
    banner.id = 'onetrust-banner-sdk';
    banner.innerHTML = '<p>We and our third-party partners use cookies…</p>' +
      '<button id="onetrust-pc-btn-handler">Cookie Preferences</button>' +
      '<button id="onetrust-accept-btn-handler">Agree</button>';
    banner.querySelector('#onetrust-accept-btn-handler').onclick = () => {
      localStorage.setItem('offline-consent', '1');
      setTimeout(() => banner.remove(), 300);
    };
    document.body.appendChild(banner);
  }, 600);
}

function stayRange(checkIn, checkOut) {
  const a = new Date(checkIn), b = new Date(checkOut);
  const month = (d) => MONTHS[d.getUTCMonth()].slice(0, 3);
  return a.getUTCMonth() === b.getUTCMonth()
    ? month(a) + ' ' + a.getUTCDate() + ' - ' + b.getUTCDate() + ', ' + b.getUTCFullYear()
    : month(a) + ' ' + a.getUTCDate() + ' - ' + month(b) + ' ' + b.getUTCDate() + ', ' + b.getUTCFullYear();
}

function toggleCartPanel() {
  const open = document.querySelector('[aria-label="User Panel"]');
  if (open) return open.remove();
  const items = readCart();
  if (DEFECT === 'count' && items.length) items.push(items[0]);
  let html = '<button aria-label="Close">×</button><div role="tablist">' +
    '<button role="tab" aria-label="Itinerary" aria-selected="false">Itinerary</button>' +
    '<button role="tab" aria-selected="true">Cart (' + items.length + ')</button></div>';
  if (items.length) {
    const first = items[0];
    const checkOut = DEFECT === 'dates' ? first.checkOut + DAY_MS : first.checkOut;
    html += '<h3>Four Seasons Resort Cabo Del Sol</h3><div class="uppercase">' + stayRange(first.checkIn, checkOut) + '</div>';
    for (const item of items) {
      const room = DEFECT === 'room' ? 'Ocean-View Casita Room' : item.room;
      const bed = DEFECT === 'bed' ? 'Two queen beds' : item.bed;
      const rate = DEFECT === 'rate' ? 'Room Rate' : item.rate;
      const adults = DEFECT === 'adults' ? 1 : item.adults;
      let price = cad(DEFECT === 'price' ? item.price + 5 : item.price, 2);
      if (DEFECT === 'currency') price = price.replace('CAD', 'USD');
      html += '<div><div><img alt="" width="80" height="60"><div><span>' + room + (bed ? ' - ' + bed : '') +
        '</span><br><span>' + rate + '</span><br><span>' + adults + ' adults</span><br><button>Remove</button>' +
        '</div></div><div><span>' + price + '</span><span data-cy="shopping-cart-item__taxes-and-fees">' +
        ' before addition of Service Charge plus taxes per night</span></div></div>';
    }
    // ≈ 15 % service charge + taxes, as observed live; the total defects distort it.
    const uplift = { untaxed: 1, undercharge: 0.5, overcharge: 2 * 1.3786 }[DEFECT] ?? 1.3786;
    const total = readCart().reduce((sum, item) => sum + item.price * item.nights * uplift, 0);
    html += '<div><span>Taxes &amp; Fees</span><span>To be calculated at checkout</span></div>' +
      '<div><span>Est. Total</span><span>' + cad(Math.round(total * 100) / 100, 2) + '</span></div>' +
      '<a href="#">Check out itinerary</a>';
  }
  const panel = document.createElement('div');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'User Panel');
  panel.innerHTML = html;
  document.body.appendChild(panel);
}

renderCartCount();
showCookieBanner();
document.getElementById('shopping_cart_icon').onclick = toggleCartPanel;
`;

// The availability widget: a two-month range picker whose labels change as the selection progresses.
const WIDGET_HTML = `
<div role="form" aria-label="Check Rates and Availability">
  <div><small>CHECK IN — CHECK OUT</small><div id="datefield-id" role="button" tabindex="0"></div></div>
  <div><small>GUESTS</small><div id="occupancyId" role="button" tabindex="0">1 Room - 2 Adults</div></div>
  <div><small>PROMO</small><input id="promoCode" placeholder="Promo Code"></div>
  <button type="button" id="check-rates">Check Rates</button>
  <div class="popup hidden" id="calendar-popup">
    <button type="button" aria-label="Previous month">‹</button>
    <button type="button" aria-label="Next month" id="next-month">›</button>
    <div role="application" aria-label="Calendar Stay Dates"><div class="months" id="months"></div></div>
    <p>From CAD per night. Taxes and fees may apply.</p>
    <button type="button" id="apply-dates">Apply</button>
  </div>
</div>
<div class="hidden"><button type="button">Apply</button></div>`;

const widgetScript = ({ soldOutOffsetDays }) => String.raw`
const params = new URLSearchParams(location.search);
const state = {
  view: Date.UTC(new Date(todayUtc()).getUTCFullYear(), new Date(todayUtc()).getUTCMonth(), 1),
  checkIn: params.has('generalReservationForm.checkInDate') ? Date.parse(params.get('generalReservationForm.checkInDate')) : todayUtc(),
  checkOut: params.has('generalReservationForm.checkOutDate') ? Date.parse(params.get('generalReservationForm.checkOutDate')) : todayUtc() + DAY_MS,
  pickingCheckOut: false,
};
const soldOut = (t) => t === todayUtc() + ${soldOutOffsetDays} * DAY_MS;

function renderDateField() {
  const field = document.getElementById('datefield-id');
  field.innerHTML = state.pickingCheckOut
    ? '<span class="sr-only">Select Dates for Check-in and Check-out</span>' + usDate(state.checkIn) + ' - '
    : '<span class="sr-only">Selected Dates ' + words(state.checkIn) + ' to ' + words(state.checkOut) + '</span>' +
      usDate(state.checkIn) + ' - ' + usDate(state.checkOut);
  document.getElementById('apply-dates').disabled = state.pickingCheckOut;
  document.getElementById('check-rates').disabled = state.pickingCheckOut;
}

function dayButton(t) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = new Date(t).getUTCDate();
  let prefix;
  if (t < todayUtc()) { prefix = 'Out of Range'; button.disabled = true; }
  else if (!state.pickingCheckOut) {
    prefix = soldOut(t) ? 'Unavailable check-in date' : 'Available check-in date';
    button.disabled = soldOut(t);
  } else {
    const nights = Math.round((t - state.checkIn) / DAY_MS);
    prefix = nights === 1 ? 'Available for checkout' : 'Available check-out date';
    button.disabled = nights < 1 || nights > 30;
  }
  button.setAttribute('aria-label', prefix + ' ' + longLabel(t));
  button.onclick = () => {
    if (state.pickingCheckOut) { state.checkOut = t; state.pickingCheckOut = false; }
    else { state.checkIn = t; state.pickingCheckOut = true; }
    renderDateField();
    renderCalendar();
  };
  return button;
}

function renderCalendar() {
  const months = document.getElementById('months');
  months.innerHTML = '';
  for (let offset = 0; offset < 2; offset++) {
    const first = new Date(state.view);
    first.setUTCMonth(first.getUTCMonth() + offset);
    const month = document.createElement('div');
    month.innerHTML = '<h4 class="uppercase">' + MONTHS[first.getUTCMonth()] + ' ' + first.getUTCFullYear() + '</h4>';
    const days = document.createElement('div');
    days.className = 'days';
    for (let t = first.getTime(); new Date(t).getUTCMonth() === first.getUTCMonth(); t += DAY_MS) days.appendChild(dayButton(t));
    month.appendChild(days);
    months.appendChild(month);
  }
}

document.getElementById('datefield-id').onclick = () => {
  document.getElementById('calendar-popup').classList.toggle('hidden');
  renderCalendar();
};
// Like the live widget, paging re-renders asynchronously (~0.7 s).
document.getElementById('next-month').onclick = () => setTimeout(() => {
  const next = new Date(state.view);
  next.setUTCMonth(next.getUTCMonth() + 1);
  state.view = next.getTime();
  renderCalendar();
}, 700);
document.getElementById('apply-dates').onclick = () => document.getElementById('calendar-popup').classList.add('hidden');
document.getElementById('check-rates').onclick = () => {
  location.href = '/cabodelsol/accommodations/?generalReservationForm.checkInDate=' + iso(state.checkIn) +
    '&generalReservationForm.checkOutDate=' + iso(state.checkOut) +
    '&generalReservationForm.guestCountPerRoom[0].adultCount=2&generalReservationForm.guestCountPerRoom[0].childCount=0' +
    '&generalReservationForm.locationId=SJD245';
};
renderDateField();
`;

// Room results render late; adding a room updates the header count first and redirects ~1.5 s later.
const RESULTS_SCRIPT = String.raw`
const ROOMS = ${JSON.stringify(ROOMS)};
const RATES = ${JSON.stringify(RATES)};
const nights = Math.round((state.checkOut - state.checkIn) / DAY_MS);

function addToCart(room, rate, bed, price) {
  localStorage.setItem('offline-cart', JSON.stringify([{ room: room.name, bed, rate: rate.name,
    price: Math.round(price * 100) / 100, adults: 2, nights, checkIn: state.checkIn, checkOut: state.checkOut }]));
  renderCartCount();
  if (REDIRECT_AFTER_ADD) setTimeout(() => { location.href = '/cabodelsol/discover/'; }, 1500);
}

function rateRow(room, rate) {
  const lowest = (room.beds ? room.beds[0].price : room.price) * rate.factor;
  const row = document.createElement('div');
  row.className = 'rate';
  row.innerHTML = '<div><div>' + rate.name + '</div><button type="button" class="rate-details">Rate Details</button>' +
    '<span>' + rate.terms + '</span></div><div><div><div>Avg. price per night</div><span class="price">' +
    (room.beds ? 'From ' : '') + cad(Math.round(lowest), 0) + '</span></div>' +
    '<div data-cy="rate-card-fees-disclaimer"><span>before addition of Service Charge plus taxes per night</span></div>' +
    '<div class="cta"></div></div>';
  const cta = row.querySelector('.cta');
  if (!room.beds) {
    cta.innerHTML = '<button type="button" data-tracking-id="add-to-cart">Add to Cart</button>';
    cta.firstChild.onclick = () => addToCart(room, rate, null, room.price * rate.factor);
    return row;
  }
  cta.innerHTML = '<button type="button" data-tracking-id="select-bed-options">Select Bed Options</button>';
  cta.firstChild.onclick = () => {
    // Expanding one rate hides the other rates' buttons, as on the live site.
    document.querySelectorAll('[data-tracking-id="select-bed-options"]').forEach((b) => b !== cta.firstChild && b.remove());
    row.querySelector('.price').textContent = cad(Math.round(room.beds[0].price * rate.factor), 0);
    cta.innerHTML = '<span>Bed Options</span><div role="radiogroup">' + room.beds.map((bed, i) =>
      '<label><input type="radio" name="bed" value="0.1.' + (61 - i) + '"' + (i ? '' : ' checked') + '></label>' +
      '<div class="bed-option"><div>' + bed.name + '</div><div>' + cad(Math.round(bed.price * rate.factor), 0) + '</div></div>'
    ).join('') + '</div><button type="button" data-tracking-id="add-to-cart">Add to Cart</button>';
    cta.querySelector('button').onclick = () => {
      const chosen = [...cta.querySelectorAll('input')].findIndex((input) => input.checked);
      addToCart(room, rate, room.beds[chosen].name, room.beds[chosen].price * rate.factor);
    };
  };
  return row;
}

setTimeout(() => {
  const section = document.createElement('section');
  section.className = 'RoomListing-room-results';
  section.innerHTML = '<h2>Guest Rooms (' + ROOMS.length + ')</h2><div class="FilteredColumnsList-itemsContainer"></div>';
  for (const room of ROOMS) {
    const card = document.createElement('div');
    card.className = 'FilteredColumnsList-item FilteredColumnsList-item--list';
    card.innerHTML = '<div class="card"><a href="#">Previous slide</a> <a href="#">Next slide</a>' +
      '<div><a href="/cabodelsol/accommodations/guest-rooms/" target="_blank" rel="noreferrer"><span>' + room.name +
      '</span></a></div><button type="button">View Floor Plan &amp; Details</button></div>';
    for (const rate of RATES) card.firstChild.appendChild(rateRow(room, rate));
    section.lastChild.appendChild(card);
  }
  document.querySelector('main').appendChild(section);
}, 1200);
`;

// Qualtrics site-intercept survey: full screen, above everything, including the header cart icon.
const SURVEY_SCRIPT = `
const survey = document.createElement('div');
survey.className = 'QSIPopOver';
survey.innerHTML = '<div style="margin:20vh auto;width:280px;padding:16px;background:#222;color:#fff">' +
  'Four Seasons would greatly appreciate your feedback… brief 1 minute survey. <img alt="" width="16" height="16"></div>';
document.body.appendChild(survey);
`;

function page({ title, body = '', script = '', defect }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<style>${STYLE}</style></head><body>
<header><span>FOUR SEASONS RESORT CABO DEL SOL</span>
<button id="shopping_cart_icon" type="button" aria-label="view cart"><svg width="14" height="14"></svg><span>Cart</span></button></header>
<main>${body}</main>
<script>const DEFECT = ${JSON.stringify(defect ?? null)};\n${CLIENT_COMMON}\n${script}</script>
</body></html>`;
}

function regionAccordion(id, name, expanded) {
  return `<dt><button type="button" id="button-${id}" aria-expanded="${expanded}" aria-controls="region-${id}">${name}
  <span>55 properties</span> <span>${expanded ? 'hide' : 'show'}</span></button></dt>
<dd role="region" id="region-${id}" aria-labelledby="button-${id}"${expanded ? '' : ' class="hidden"'}><ul>
  <li><a href="/anguilla/">Anguilla</a></li>
  <li><a href="/cabodelsol/">Los Cabos (Cabo Del Sol)</a></li>
  <li><a href="/loscabos/">Los Cabos (Los Cabos at Costa Palmas™)</a></li>
  <li><a href="/mexicocity/">Mexico City</a></li>
</ul></dd>`;
}

function pages({ defect, soldOutOffsetDays, redirectAfterAdd }) {
  const widget = widgetScript({ soldOutOffsetDays });
  const results = `const REDIRECT_AFTER_ADD = ${redirectAfterAdd};\n${RESULTS_SCRIPT}`;
  return {
    '/find_a_hotel_or_resort/': page({
      defect,
      title: 'Find a Four Seasons Hotel or Resort | Four Seasons Hotels &amp; Resorts',
      // Like the live page: every property is rendered once per category tab, only one tab is visible,
      // and a featured-property link with the same text sits outside the region list.
      body: `<h1>All Hotels &amp; Resorts</h1>
<p>Featured: <a href="/cabodelsol/">Los Cabos (Cabo Del Sol)</a></p>
<div role="tabpanel" id="all-hotels-resorts-hotel-tab"><dl>
  ${regionAccordion('north-america-a', 'North America', false)}
  ${regionAccordion('central-south-america-a', 'Central &amp; South America', true)}
</dl></div>
<div role="tabpanel" id="beach-beach-tab" style="display:none"><dl>${regionAccordion('north-america-b', 'North America', true)}</dl></div>`,
      script: `document.querySelectorAll('dt button').forEach((toggle) => toggle.onclick = () => {
  const expanded = toggle.getAttribute('aria-expanded') === 'true';
  toggle.setAttribute('aria-expanded', String(!expanded));
  toggle.lastElementChild.textContent = expanded ? 'show' : 'hide';
  document.getElementById(toggle.getAttribute('aria-controls')).classList.toggle('hidden', expanded);
});`,
    }),
    '/cabodelsol/': page({
      defect,
      title: 'Cabo San Lucas Luxury Beach Resort | Four Seasons Resort Cabo Del Sol',
      body: `${WIDGET_HTML}<h1>Cabo Del Sol</h1><a href="#">Check Rates</a> <a href="#">Check Rates</a>`,
      script: widget,
    }),
    '/cabodelsol/accommodations/': page({
      defect,
      title: 'Cabo San Lucas Luxury Accommodations | Four Seasons Resort Cabo Del Sol',
      body: `${WIDGET_HTML}<h2>Choose Your Room and Package</h2>`,
      script: widget + results,
    }),
    '/cabodelsol/discover/': page({
      defect,
      title: 'Four Seasons Hotels and Resorts | Luxury Hotels | Four Seasons | Things To Do',
      body: '<h1>Things To Do</h1><p>Treat yourself to something special.</p>',
      script: SURVEY_SCRIPT,
    }),
  };
}

const ACCESS_DENIED = `<!doctype html><html><head><title>Access Denied</title></head><body><h1>Access Denied</h1>
You don't have permission to access "http://www.fourseasons.com/" on this server.</body></html>`;

/**
 * Starts the replica. `defect` injects one of DEFECTS into the cart; `deny` answers every request like the
 * bot manager does when it blocks a browser; `soldOutOffsetDays` marks today+N as sold out;
 * `redirectAfterAdd: false` keeps the guest on the results page after adding a room.
 */
export async function startOfflineSite({
  port = 0,
  defect = null,
  deny = false,
  soldOutOffsetDays = 30,
  redirectAfterAdd = true,
} = {}) {
  if (defect !== null && !(defect in DEFECTS)) throw new Error(`Unknown defect "${defect}"`);
  const routes = pages({ defect, soldOutOffsetDays, redirectAfterAdd });
  const server = createServer((request, response) => {
    const { pathname } = new URL(request.url ?? '/', 'http://localhost');
    const html = deny ? ACCESS_DENIED : routes[pathname];
    response.writeHead(deny ? 403 : html ? 200 : 404, { 'content-type': 'text/html; charset=utf-8' });
    response.end(html ?? '<h1>Not found</h1>');
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  const address = server.address();
  return {
    url: `http://127.0.0.1:${typeof address === 'object' && address ? address.port : port}`,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  };
}

const runDirectly =
  process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (runDirectly) {
  const site = await startOfflineSite({ port: Number(process.env.PORT ?? 4173) });
  console.log(`Offline replica on ${site.url} (Ctrl+C to stop)`);
}
