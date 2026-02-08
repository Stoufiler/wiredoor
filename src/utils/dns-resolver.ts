import { Resolver } from 'dns';

export class CustomDNSResolver {
  public resolver: Resolver;

  constructor(timeout?: number) {
    this.resolver = new Resolver();
    if (timeout) {
      this.resolver.setServers(['8.8.8.8', '1.1.1.1']); // Default if needed
      // Node.js dns.Resolver doesn't have a direct setTimeout method like some others,
      // but we can use it as a base for custom logic if needed.
    }
  }

  async resolve(domain: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.resolver.resolve(domain, (err, addresses) => {
        if (err) reject(err);
        else resolve(addresses || []);
      });
    });
  }

  // For A/AAAA records specifically
  async resolve4(domain: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.resolver.resolve4(domain, (err, addresses) => {
        if (err) reject(err);
        else resolve(addresses);
      });
    });
  }
}
