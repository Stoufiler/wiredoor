import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { validateDomainArray } from '../../validators/http-service-validator';

// Mock logger
jest.mock('../../logger', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('HTTP Service Validator - Domain Arrays', () => {
  let mockValidateDomain: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Access the mocked DNSValidator from the global mock
    const { DNSValidator: dnsValidatorMock } = require('src/utils/dns-validator');
    mockValidateDomain = jest.fn();
    dnsValidatorMock.mockImplementation(() => ({
      validateDomain: mockValidateDomain,
    } as any));
  });

  it('should validate empty domain array', async () => {
    const result = await validateDomainArray([]);
    expect(result).toEqual([]);
    expect(mockValidateDomain).not.toHaveBeenCalled();
  });

  it('should validate valid domains', async () => {
    mockValidateDomain.mockResolvedValue(['192.168.1.1']);

    const domains = ['example.com', 'test.org'];
    const result = await validateDomainArray(domains);

    expect(result).toEqual(domains);
    expect(mockValidateDomain).toHaveBeenCalledTimes(2);
    expect(mockValidateDomain).toHaveBeenCalledWith('example.com');
    expect(mockValidateDomain).toHaveBeenCalledWith('test.org');
  });

  it('should throw error for invalid domain format', async () => {
    const domains = ['invalid..domain'];

    await expect(validateDomainArray(domains)).rejects.toThrow('invalid domain in array');
  });

  it('should handle DNS resolution failure gracefully', async () => {
    mockValidateDomain.mockRejectedValue(new Error('DNS failure'));

    const domains = ['failing.com'];
    const result = await validateDomainArray(domains);

    expect(result).toEqual(domains); // Still returns the domains
    expect(mockValidateDomain).toHaveBeenCalledWith('failing.com');
  });
});