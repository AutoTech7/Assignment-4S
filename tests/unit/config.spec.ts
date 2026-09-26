import { expect, test } from '@playwright/test';
import { ConfigError, parseEnv } from '@config/parse-env';
import { hostResolverRules } from '@support/network-hygiene';

test.describe('configuration', () => {
  test('defaults: live site, 30 days out, 1 night, headed locally', () => {
    expect(parseEnv({})).toMatchObject({
      isCI: false,
      baseUrl: 'https://www.fourseasons.com',
      headless: false,
      checkInOffsetDays: 30,
      nights: 1,
      availabilitySearchDays: 14,
      blockThirdParty: false,
      slowMoMs: 0,
    });
  });

  test('CI runs headless unless told otherwise; recording slows down and stays headed', () => {
    expect(parseEnv({ CI: 'true' }).headless).toBe(true);
    expect(parseEnv({ CI: 'true', HEADLESS: 'false' }).headless).toBe(false);
    expect(parseEnv({ RECORD_MODE: 'true' })).toMatchObject({ headless: false, slowMoMs: 400 });
  });

  test('any CI value other than an explicit "no" means CI', () => {
    expect(parseEnv({ CI: '1' }).isCI).toBe(true);
    expect(parseEnv({ CI: 'github' }).isCI).toBe(true);
    expect(parseEnv({ CI: 'false' }).isCI).toBe(false);
    expect(parseEnv({ CI: '' }).isCI).toBe(false);
  });

  test('invalid values fail fast with the variable name', () => {
    expect(() => parseEnv({ NIGHTS: 'two' })).toThrow(ConfigError);
    expect(() => parseEnv({ NIGHTS: '0' })).toThrow('NIGHTS must be an integer from 1 to 14, received "0"');
    expect(() => parseEnv({ HEADLESS: 'maybe' })).toThrow('HEADLESS must be true or false');
    expect(() => parseEnv({ BASE_URL: 'fourseasons.com' })).toThrow('BASE_URL must be an absolute URL');
  });

  test('third-party hosts are blocked at the resolver, subdomains included', () => {
    expect(hostResolverRules(['siteintercept.qualtrics.com'])).toBe(
      'MAP siteintercept.qualtrics.com ~NOTFOUND, MAP *.siteintercept.qualtrics.com ~NOTFOUND',
    );
    expect(hostResolverRules()).not.toContain('fourseasons.com');
  });
});
