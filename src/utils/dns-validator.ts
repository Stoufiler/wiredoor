import { resolve4, resolve6 } from 'dns/promises';
import promiseRetry from 'promise-retry';
import { Service } from 'typedi';
import { createLogger, ILogger } from '../logger';
import config from '../config';
import { DNSCache } from './dns-cache';
import { CustomDNSResolver } from './dns-resolver';

@Service()
export class DNSValidator {
  private logger: ILogger;
  private cache: DNSCache;
  private resolver: CustomDNSResolver;

  constructor() {
    this.logger = createLogger({ serviceName: 'DNSValidator' });
    this.cache = new DNSCache(config.dns.cacheTtlMs);
    this.resolver = new CustomDNSResolver();
  }

  async validateDomain(
    domain: string,
    ipv6: boolean = false,
  ): Promise<string[]> {
    try {
      const result = await promiseRetry(
        async (retry, attempt) => {
          try {
            const addresses = ipv6
              ? await resolve6(domain)
              : await resolve4(domain);
            this.logger.debug('DNS resolution successful', {
              domain,
              ipv6,
              attempt,
              addresses,
            });
            return addresses;
          } catch (error: any) {
            this.logger.warn('DNS resolution failed, retrying', {
              domain,
              ipv6,
              attempt,
              error: error.message,
              errorCode: error.code,
            });
            retry(error);
          }
        },
        {
          retries: 5,
          factor: 2,
          minTimeout: 1000,
          maxTimeout: 30000,
          randomize: true, // Jitter
        },
      );
      return result;
    } catch (error: any) {
      this.logger.error('DNS resolution failed after retries', error, {
        domain,
        ipv6,
      });
      throw error;
    }
  }

  async validateDomainWithCache(domain: string): Promise<string[]> {
    return this.cache.resolveWithCache(domain, this.resolver.resolver);
  }
}
