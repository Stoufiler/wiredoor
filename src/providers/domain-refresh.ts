import Container from 'typedi';
import { HttpServicesService } from '../services/http-services-service';
import { TcpServicesService } from '../services/tcp-services-service';
import { Logger } from '../logger';
import config from '../config';
import CLI from '../utils/cli';

let interval: NodeJS.Timeout | null = null;

export async function startDomainRefresh(): Promise<void> {
  if (interval) return;

  const refresh = async (): Promise<void> => {
    try {
      Logger.debug('Refreshing domain-based IP whitelists...');
      const httpSvc = Container.get(HttpServicesService);
      const tcpSvc = Container.get(TcpServicesService);

      await Promise.all([
        httpSvc.refreshDomainIps(),
        tcpSvc.refreshDomainIps(),
      ]);

      // Reload Nginx once after all configs are updated
      await CLI.exec('nginx -s reload');
      Logger.debug('Domain-based IP whitelists refreshed successfully.');
    } catch (e: Error | any) {
      Logger.error('Error refreshing domain IPs:', e);
    }
  };

  // Run once on startup
  await refresh();

  interval = setInterval(refresh, config.dns.refreshInterval);
}

export function stopDomainRefresh(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
