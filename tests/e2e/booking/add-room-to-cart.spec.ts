import { CABO_DEL_SOL } from '@data/properties';
import { adultsLabel, cartItemTitle } from '@models/booking';
import { expect, test } from '@fixtures';
import { formatMoney } from '@utils/money';
import { formatStay } from '@utils/stay-range';

const property = CABO_DEL_SOL;

test.describe('Booking funnel', { tag: ['@booking', '@e2e'] }, () => {
  test(
    'guest adds a Cabo del Sol room to the cart and sees it with the correct price',
    { tag: '@smoke' },
    async ({ step, stayRequest, findHotelPage, propertyPage, roomSelectionPage, siteHeader }) => {
      await step('a) Navigate to "Find a Hotel or Resort"', async () => {
        await findHotelPage.open();
      });

      await step(`b) Select "${property.listingName}"`, async () => {
        await findHotelPage.selectProperty(property);
        await propertyPage.expectLoaded(property);
      });

      const search = await step('c) Check rates for a future stay with the availability tool', async () => {
        const search = await propertyPage.bookingWidget.checkRates(stayRequest);
        await roomSelectionPage.expectResultsFor(property, search);
        return search;
      });

      const selection = await step('d) Add a room to the cart', async () => {
        const selection = await roomSelectionPage.addFirstBookableRoomToCart(property);
        await siteHeader.expectCartCount(1);
        return selection;
      });

      test.info().annotations.push(
        { type: 'Stay', description: `${formatStay(search)} · ${adultsLabel(search.occupancy)}` },
        {
          type: 'Room',
          description: `${cartItemTitle(selection)} · ${selection.rateName} · ${formatMoney(selection.nightlyPrice)}/night`,
        },
      );

      const cart = await step('e) Open the cart from the header icon', () => siteHeader.openCart());

      await step('f) Verify the selected room is in the cart with the correct pricing', async () => {
        await expect(cart.items, 'exactly one room in the cart').toHaveCount(1);
        await expect(cart.propertyHeading(property), 'cart groups the room under the property').toBeVisible();
        expect(formatStay(await cart.stayDatesFor(property)), 'stay dates').toBe(formatStay(search));

        const item = cart.item(0);
        await expect(item.root, 'room and bed type').toContainText(cartItemTitle(selection), {
          ignoreCase: true,
        });
        await expect(item.root, 'rate plan').toContainText(selection.rateName, { ignoreCase: true });
        await expect(item.root, 'guests').toContainText(adultsLabel(search.occupancy), { ignoreCase: true });

        // The room list rounds to whole units (CAD 1,449); the cart shows the exact rate (CAD 1,448.81).
        const nightlyPrice = await item.nightlyPrice();
        expect(nightlyPrice, 'nightly rate in cart vs. rate card').toMatchPriceWithinRounding(
          selection.nightlyPrice,
        );
        await test.info().attach('cart', { body: await cart.root.screenshot(), contentType: 'image/png' });
      });
    },
  );
});
