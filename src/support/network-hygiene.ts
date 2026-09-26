/**
 * Ad/social pixels and the Qualtrics survey intercept, which covered the page after add-to-cart. They add
 * latency and overlays the test does not need. First-party scripts, bot manager included, are untouched.
 */
const NOISY_THIRD_PARTY_HOSTS: readonly string[] = [
  'siteintercept.qualtrics.com',
  'connect.facebook.net',
  'analytics.tiktok.com',
  'tr.snapchat.com',
  'sc-static.net',
  'snap.licdn.com',
  'bat.bing.com',
  'googleads.g.doubleclick.net',
  's.yimg.jp',
  'tag.rmp.rakuten.com',
  'munchkin.marketo.net',
];

/**
 * `--host-resolver-rules` value that makes these hosts and their subdomains fail DNS. Unlike `page.route`,
 * it keeps the HTTP cache on and does not proxy every request through the test runner.
 */
export function hostResolverRules(hosts: readonly string[] = NOISY_THIRD_PARTY_HOSTS): string {
  return hosts.flatMap((host) => [`MAP ${host} ~NOTFOUND`, `MAP *.${host} ~NOTFOUND`]).join(', ');
}
