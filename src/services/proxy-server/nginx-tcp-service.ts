import { Service, Inject } from 'typedi';
import Container from 'typedi';
import { TcpService } from '../../database/models/tcp-service';
import { NginxService } from './nginx-service';
import { NginxConf } from './conf/nginx-conf';
import IP_CIDR from '../../utils/ip-cidr';
import { NginxServerConf } from './conf/nginx-server-conf';
import ServerUtils from '../../utils/server';
import { DomainRepository } from '../../repositories/domain-repository';
import { SSLManager } from './ssl-manager';
import { Logger } from '../../logger';
import { DNSValidator } from '../../utils/dns-validator';

@Service()
export class NginxTcpService extends NginxService {
  async create(service: TcpService, restart = true): Promise<boolean> {
    if (!service.enabled) {
      if (restart) {
        await this.reloadNginx();
      }
      return;
    }

    const streamConf = new NginxConf();

    const serverAddress =
      (service.node.isGateway || service.node.isLocal) && service.backendHost
        ? service.backendHost
        : service.node.address;

    const serverConf = new NginxServerConf();

    const allowedIps = [...(service.allowedIps || [])];
    const blockedIps = [...(service.blockedIps || [])];

    if (service.allowedDomains?.length) {
      const dnsValidator = Container.get(DNSValidator);
      for (const domain of service.allowedDomains) {
        try {
          const resolved = await dnsValidator.validateDomainWithCache(domain);
          allowedIps.push(...resolved);
        } catch (e) {
          Logger.warn(`Failed to resolve allowed domain ${domain}`, e);
        }
      }
    }

    if (service.blockedDomains?.length) {
      const dnsValidator = Container.get(DNSValidator);
      for (const domain of service.blockedDomains) {
        try {
          const resolved = await dnsValidator.validateDomainWithCache(domain);
          blockedIps.push(...resolved);
        } catch (e) {
          Logger.warn(`Failed to resolve blocked domain ${domain}`, e);
        }
      }
    }

    if (blockedIps.length) {
      for (const ipOrSubnet of blockedIps) {
        serverConf.setDeny(ipOrSubnet);
      }
    }

    if (allowedIps.length) {
      for (const ipOrSubnet of allowedIps) {
        serverConf.setAllow(ipOrSubnet);
      }
      serverConf.setDeny('all');
    }

    serverConf
      .setListen(`${service.port}${service.proto === 'udp' ? ' udp' : ''}`)
      .setServerName(service.domain || '')
      .setAccessLog(
        ServerUtils.getLogFilePath(
          service.domain || '_',
          `${service.identifier}.log`,
        ),
        'stream_logs',
      )
      .setErrorLog(
        ServerUtils.getLogFilePath(
          service.domain || '_',
          `${service.identifier}_error.log`,
        ),
      );

    if (service.ssl) {
      if (service.domain) {
        const domain = await Container.get(DomainRepository).getDomainByName(
          service.domain,
        );

        if (domain?.sslPair) {
          serverConf.setStreamSSLCertificate(domain.sslPair);
        } else {
          const sslPair = await SSLManager.getSelfSignedCertificates(
            service.domain,
          );
          serverConf.setStreamSSLCertificate(sslPair);
        }
      } else {
        const sslPair = await SSLManager.getSelfSignedCertificates('_');
        serverConf.setStreamSSLCertificate(sslPair);
      }
    }

    if (
      service.node.isGateway &&
      service.backendHost &&
      !IP_CIDR.isValidIP(service.backendHost)
    ) {
      serverConf.addBlock('resolver', `${service.node.address} valid=30s`);
      serverConf.addBlock('resolver_timeout', '3s');
    }

    serverConf.addBlock(`set $${service.identifier}`, serverAddress);
    serverConf.addBlock(
      'proxy_pass',
      `$${service.identifier}:${service.backendPort}`,
    );

    streamConf.addServer(serverConf);

    const confFile = `/etc/nginx/stream.d/${service.identifier}.conf`;

    await this.saveFile(confFile, streamConf.getNginxConf());

    Logger.info(
      `Saved TCP stream config for ${service.publicAccess} to ${confFile}`,
    );

    return this.checkAndReload(confFile, restart);
  }

  async remove(service: TcpService, restart = true): Promise<void> {
    const confFile = `/etc/nginx/stream.d/${service.identifier}.conf`;

    await this.removeFile(confFile);

    Logger.info(
      `Removed TCP stream config ${confFile} for ${service.publicAccess}`,
    );

    this.resetTCPConnections(service);

    if (restart) {
      await this.reloadNginx();
    }
  }
}
