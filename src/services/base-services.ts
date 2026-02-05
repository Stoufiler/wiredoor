import { Service } from 'typedi';
import { NodeRepository } from '../repositories/node-repository';
import { NotFoundError } from 'routing-controllers';
import IP_CIDR from '../utils/ip-cidr';
import Net from '../utils/net';
import { ValidationError } from '../utils/errors/validation-error';
import config from '../config';
import { DomainsService } from './domains-service';
import { Logger } from '../logger';
import { DNSValidator } from '../utils/dns-validator';

@Service()
export class BaseServices {
  constructor(
    protected readonly nodeRepository: NodeRepository,
    protected readonly domainService: DomainsService,
    protected readonly dnsValidator: DNSValidator,
  ) {}

  protected async checkNodePort(
    nodeId: number,
    port: number,
    host?: string,
    ssl?: boolean,
  ): Promise<void> {
    const node = await this.nodeRepository.findOne({
      where: { id: nodeId },
    });

    if (!node) {
      throw new NotFoundError('Node not found!');
    }

    if (
      node.isLocal &&
      ['127.0.0.1', 'localhost'].includes(host) &&
      +port !== +config.app.port
    ) {
      throw new ValidationError({
        body: [
          {
            field: 'backendHost',
            message: `Cannot use localhost as backendHost for local node.`,
          },
        ],
      });
    }

    const server =
      (node.isGateway || node.isLocal) && host ? host : node.address;
    const resolver =
      node.isGateway && host && !IP_CIDR.isValidIP(host) ? node.address : null;

    const portAvailable = await Net.checkPort(server, port, resolver, ssl);

    if (!portAvailable) {
      throw new ValidationError({
        body: [
          {
            field: 'backendPort',
            message: `Unable to connect to port ${port} in ${server}`,
          },
        ],
      });
    }
  }

  protected async checkOrCreateDomain(domain: string): Promise<void> {
    if (domain) {
      try {
        await this.domainService.createDomainIfNotExists(domain);
      } catch (err: any) {
        Logger.error(
          `Error creating or checking domain ${domain}: ${err.message}`,
          err,
        );
        if (err instanceof ValidationError) {
          throw err;
        }
        throw new ValidationError({
          body: [
            {
              field: 'domain',
              message: `Unable to create or use this domain`,
            },
          ],
        });
      }
    }
  }

  protected async resolveDomainsToIps(domains: string[]): Promise<string[]> {
    if (!domains || domains.length === 0) return [];
    const ips: string[] = [];
    for (const domain of domains) {
      try {
        const resolved = await this.dnsValidator.validateDomain(domain);
        ips.push(...resolved);
      } catch {
        // Skip invalid domains
      }
    }
    return [...new Set(ips)]; // Unique IPs
  }
}
