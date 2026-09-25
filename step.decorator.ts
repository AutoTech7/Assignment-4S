import { test } from '@playwright/test';

type AsyncMethod<This, Args extends unknown[], Return> = (this: This, ...args: Args) => Promise<Return>;

/**
 * Wraps a page-object method in `test.step`, so reports read as intent ("BookingWidget.checkRates") rather
 * than clicks. `box: true` reports failures at the calling line.
 *
 * @example
 *   @step()
 *   async checkRates(request: StayRequest) { … }
 */
export function step(title?: string) {
  return function decorate<This extends object, Args extends unknown[], Return>(
    method: AsyncMethod<This, Args, Return>,
    context: ClassMethodDecoratorContext<This, AsyncMethod<This, Args, Return>>,
  ): AsyncMethod<This, Args, Return> {
    return function stepped(this: This, ...args: Args): Promise<Return> {
      const name = title ?? `${this.constructor.name}.${String(context.name)}`;
      return test.step(name, () => method.apply(this, args), { box: true });
    };
  };
}
