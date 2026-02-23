import axios from 'axios';
import { parseString } from 'xml2js';
import { promisify } from 'util';
import { config } from './config.js';

const parseXml = promisify(parseString);

class NamecheapAPI {
  constructor() {
    this.apiUrl = config.namecheap.apiUrl;
    this.apiKey = config.namecheap.apiKey;
    this.username = config.namecheap.username;
    this.clientIp = config.namecheap.clientIp;
  }

  async makeRequest(command, params = {}) {
    const requestParams = {
      ApiUser: this.username,
      ApiKey: this.apiKey,
      UserName: this.username,
      ClientIp: this.clientIp,
      Command: command,
      ...params,
    };

    try {
      const response = await axios.get(this.apiUrl, {
        params: requestParams,
      });

      const parsed = await parseXml(response.data);

      // Check for API errors
      if (parsed.ApiResponse.$.Status === 'ERROR') {
        const errors = parsed.ApiResponse.Errors[0].Error;
        const errorMessage = errors.map(e => e._).join(', ');
        throw new Error(`Namecheap API Error: ${errorMessage}`);
      }

      return parsed.ApiResponse;
    } catch (error) {
      if (error.response) {
        throw new Error(`Namecheap API request failed: ${error.response.status} - ${error.response.statusText}`);
      }
      throw error;
    }
  }

  async checkDomain(domainName) {
    console.log(`Checking availability for domain: ${domainName}`);

    const response = await this.makeRequest('namecheap.domains.check', {
      DomainList: domainName,
    });

    const domainResult = response.CommandResponse[0].DomainCheckResult[0].$;

    return {
      domain: domainResult.Domain,
      available: domainResult.Available === 'true',
      premium: domainResult.IsPremiumName === 'true',
      premiumPrice: domainResult.PremiumRegistrationPrice || null,
    };
  }

  async registerDomain(domainName, years = 1, contacts = null) {
    console.log(`Registering domain: ${domainName} for ${years} year(s)`);

    // Use provided contacts or default from config
    const contactInfo = contacts || config.domain.defaultContacts;

    const params = {
      DomainName: domainName,
      Years: years,

      // Registrant Contact
      RegistrantFirstName: contactInfo.firstName,
      RegistrantLastName: contactInfo.lastName,
      RegistrantAddress1: contactInfo.address1,
      RegistrantCity: contactInfo.city,
      RegistrantStateProvince: contactInfo.stateProvince,
      RegistrantPostalCode: contactInfo.postalCode,
      RegistrantCountry: contactInfo.country,
      RegistrantPhone: contactInfo.phone,
      RegistrantEmailAddress: contactInfo.email,

      // Tech Contact (same as registrant)
      TechFirstName: contactInfo.firstName,
      TechLastName: contactInfo.lastName,
      TechAddress1: contactInfo.address1,
      TechCity: contactInfo.city,
      TechStateProvince: contactInfo.stateProvince,
      TechPostalCode: contactInfo.postalCode,
      TechCountry: contactInfo.country,
      TechPhone: contactInfo.phone,
      TechEmailAddress: contactInfo.email,

      // Admin Contact (same as registrant)
      AdminFirstName: contactInfo.firstName,
      AdminLastName: contactInfo.lastName,
      AdminAddress1: contactInfo.address1,
      AdminCity: contactInfo.city,
      AdminStateProvince: contactInfo.stateProvince,
      AdminPostalCode: contactInfo.postalCode,
      AdminCountry: contactInfo.country,
      AdminPhone: contactInfo.phone,
      AdminEmailAddress: contactInfo.email,

      // Billing Contact (same as registrant)
      AuxBillingFirstName: contactInfo.firstName,
      AuxBillingLastName: contactInfo.lastName,
      AuxBillingAddress1: contactInfo.address1,
      AuxBillingCity: contactInfo.city,
      AuxBillingStateProvince: contactInfo.stateProvince,
      AuxBillingPostalCode: contactInfo.postalCode,
      AuxBillingCountry: contactInfo.country,
      AuxBillingPhone: contactInfo.phone,
      AuxBillingEmailAddress: contactInfo.email,
    };

    const response = await this.makeRequest('namecheap.domains.create', params);
    const result = response.CommandResponse[0].DomainCreateResult[0].$;

    return {
      domain: result.Domain,
      registered: result.Registered === 'true',
      chargedAmount: parseFloat(result.ChargedAmount),
      domainId: result.DomainID,
      orderId: result.OrderID,
      transactionId: result.TransactionID,
    };
  }

  async setDnsHosts(domainName, hosts) {
    console.log(`Setting DNS hosts for domain: ${domainName}`);

    const params = {
      SLD: domainName.split('.')[0], // Second Level Domain
      TLD: domainName.split('.').slice(1).join('.'), // Top Level Domain
    };

    // Add hosts to params
    hosts.forEach((host, index) => {
      const num = index + 1;
      params[`HostName${num}`] = host.name;
      params[`RecordType${num}`] = host.type;
      params[`Address${num}`] = host.address;
      params[`TTL${num}`] = host.ttl || 1800;
    });

    const response = await this.makeRequest('namecheap.domains.dns.setHosts', params);
    const result = response.CommandResponse[0].DomainDNSSetHostsResult[0].$;

    return {
      domain: result.Domain,
      success: result.IsSuccess === 'true',
    };
  }

  async getDomainInfo(domainName) {
    console.log(`Getting domain info for: ${domainName}`);

    const response = await this.makeRequest('namecheap.domains.getInfo', {
      DomainName: domainName,
    });

    return response.CommandResponse[0].DomainGetInfoResult[0];
  }

  async setCustomNameservers(domainName, nameservers) {
    console.log(`Setting custom nameservers for: ${domainName}`);
    console.log(`Nameservers: ${nameservers.join(', ')}`);

    const params = {
      SLD: domainName.split('.')[0], // Second Level Domain
      TLD: domainName.split('.').slice(1).join('.'), // Top Level Domain
      Nameservers: nameservers.join(','),
    };

    const response = await this.makeRequest('namecheap.domains.dns.setCustom', params);
    const result = response.CommandResponse[0].DomainDNSSetCustomResult[0].$;

    console.log(`✅ Nameservers updated successfully!`);

    return {
      domain: result.Domain,
      success: result.Update === 'true',
    };
  }

  async getNameservers(domainName) {
    console.log(`Getting nameservers for: ${domainName}`);

    const domainInfo = await this.getDomainInfo(domainName);
    const dnsDetails = domainInfo.DnsDetails[0];

    return {
      type: dnsDetails.$.ProviderType, // DNS, CUSTOM, etc.
      nameservers: dnsDetails.Nameserver || [],
    };
  }
}

export default NamecheapAPI;
