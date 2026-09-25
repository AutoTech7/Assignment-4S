# fourseasons-booking-e2e

End-to-end test of the Four Seasons booking funnel, in Playwright and TypeScript.

The scenario opens _Find a Hotel or Resort_, selects Los Cabos (Cabo del Sol), checks rates for a date 30 days
out, adds a room to the cart, opens the cart and verifies the room and its price. It stops there: nothing is
booked and no guest details are entered.

Recording of a live run:
[MP4](recordings/guest-adds-a-cabo-del-sol-room-to-the-cart-and-sees-it-with-the-correct-price.mp4) ·
[WebM](recordings/guest-adds-a-cabo-del-sol-room-to-the-cart-and-sees-it-with-the-correct-price.webm) ·
[run details](recordings/guest-adds-a-cabo-del-sol-room-to-the-cart-and-sees-it-with-the-correct-price.json) ·
[trace](recordings/guest-adds-a-cabo-del-sol-room-to-the-cart-and-sees-it-with-the-correct-price.trace.zip)

## Running

Requires Node 22+.

```bash
npm ci
npx playwright install chromium
npm run test:e2e    # headed, against www.fourseasons.com
npm run report      # HTML report; failures include trace, screenshot and video
```

| Command                  | Purpose                                                                  |
| ------------------------ | ------------------------------------------------------------------------ |
| `npm run test:unit`      | unit tests for prices, dates and parsers (no browser)                    |
| `npm run record`         | live run with step captions, saved to `recordings/` (MP4 needs `ffmpeg`) |
| `npm run verify`         | typecheck, lint, format check, unit tests                                |
| `npm run test:offline`   | the spec against a local replica of the funnel                           |
| `npm run test:mutations` | seeds cart defects in the replica; each must fail the intended assertion |

## Scenario

[`tests/e2e/booking/add-room-to-cart.spec.ts`](tests/e2e/booking/add-room-to-cart.spec.ts)

| Step                               | Checks                                                                                          |
| ---------------------------------- | ----------------------------------------------------------------------------------------------- |
| a. Open `/find_a_hotel_or_resort/` | page loaded, not bot-blocked                                                                    |
| b. Select Los Cabos (Cabo del Sol) | property URL and title, availability widget                                                     |
| c. Check rates for today + 30 days | results page for the selected dates                                                             |
| d. Add the first bookable room     | header shows `Cart(1)`                                                                          |
| e. Open the cart                   | cart panel open                                                                                 |
| f. Verify the room and pricing     | one item under the property; dates, room, bed, rate plan, guests; nightly rate; estimated total |

Pricing:

- The rate card rounds to whole units (CAD 1,449) and the cart shows cents (CAD 1,448.81). Prices are parsed
  into integer minor units and must share a currency and differ by less than one display unit.
- The estimated total adds a 15% service charge and taxes, so it must be 1.15–1.6× the room subtotal.
- Currency follows the visitor's location; nothing assumes CAD.

## Design

- Page objects (`src/pages`) and shared widgets (`src/components`) own every locator; the spec has none.
- Locators prefer the site's own hooks (`data-tracking-id`, `data-cy`), then roles, then component classes.
- Dates are relative. A sold-out day or a minimum stay shifts the dates instead of failing the run.
- The cookie banner and survey pop-over are handled by `page.addLocatorHandler`; ad and survey hosts are
  blocked at DNS.
- No fixed waits in the flow. The redirect after adding a room is awaited but optional.
- A `@step()` decorator nests page-object steps in the report, and every assertion has a message.

More in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

```text
src/
  pages/         page objects
  components/    booking widget, calendar, room card, cart panel, header
  fixtures/      test and expect: page-object fixtures, price matchers
  support/       overlays, bot-protection guard, @step, recording
  utils/         Money, CalendarDate, parsers
  config/ data/ models/
tests/           e2e/, unit/
tools/           offline replica of the funnel
```

## Bot protection

The site runs Akamai Bot Manager, which blocks most headless and datacenter traffic. Tests run headed with
`--disable-blink-features=AutomationControlled`, with no stealth plugins, fingerprint spoofing or CAPTCHA
solving. A block fails immediately with `BotProtectionError`. Scheduled runs need the runner's IP
allow-listed by the site owner.

## CI

[`.github/workflows/e2e.yml`](.github/workflows/e2e.yml)

| Job           | Trigger                      | Runs                                                  |
| ------------- | ---------------------------- | ----------------------------------------------------- |
| `quality`     | pull request, push to `main` | typecheck, lint, format check, unit tests             |
| `e2e-offline` | pull request, push to `main` | the spec against the replica, then the mutation check |
| `e2e-live`    | weekdays 11:00 UTC, manual   | the spec against the live site, headed under Xvfb     |

The schedule stays off until the `LIVE_E2E_SCHEDULE` variable is `true`. `E2E_RUNNER` selects a runner the
site allow-lists.

## Configuration

Environment variables or a `.env` file ([`.env.example`](.env.example)). Invalid values fail fast.

| Variable                   | Default                                                     |
| -------------------------- | ----------------------------------------------------------- |
| `BASE_URL`                 | `https://www.fourseasons.com`                               |
| `CHECK_IN_OFFSET_DAYS`     | `30`                                                        |
| `NIGHTS`                   | `1`                                                         |
| `AVAILABILITY_SEARCH_DAYS` | `14` (later check-in days to try if sold out)               |
| `HEADLESS`                 | `false`, or `true` when `CI` is set                         |
| `BROWSER_CHANNEL`          | bundled Chromium; `npm run record` uses Chrome if installed |
| `SLOW_MO`                  | `0`, or `400` when recording                                |
| `BLOCK_THIRD_PARTY`        | `true`                                                      |

## Findings

Observed on the live site. None blocks the scenario.

1. The rate card and the cart show the same rate at different precision, CAD 1,449 and CAD 1,448.81
   ([screenshot](docs/images/live-cart.jpg)).
2. The estimated total is 38% above the nightly rate while taxes read "to be calculated at checkout".
3. Bed-option radio buttons have no accessible name (WCAG 1.3.1, 4.1.2).
4. The cart button's accessible name omits the item count.
5. A survey pop-over can cover the page right after a room is added
   ([screenshot](docs/images/live-cart-with-survey-popover.jpg)).

## Limitations

- Only Chromium has run against the live site.
- Expected prices come from the UI. Asserting against the rates API response would remove the rounding
  tolerance.
- Not covered: multi-night and multi-room stays, children, promo codes, removing items, currency switching,
  accessibility scans.
