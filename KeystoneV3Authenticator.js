'use strict';

const EventEmitter = require('events');
const axios = require('axios');

// Build a Keystone reference to a domain or project.
//
// Keystone validates this object strictly, so we may only send keys we
// actually have:
//   * `{"id": null}` / `{"name": null}` are rejected outright with HTTP 400
//     ("Invalid input ... None is not of type 'string'"), which is why the
//     field must be omitted rather than nulled when it is not configured;
//   * sending BOTH `id` and `name` for the same entity is also an error
//     ("Cannot use both id and name"), so an id wins when both are given.
// Callers that configure only OS_PROJECT_ID / OS_PROJECT_DOMAIN_ID (ids, no
// names) must therefore produce exactly `{"id": "<id>"}`.
function identify(id, name) {
  if (id) return { id };
  if (name) return { name };
  return {};
}

class KeystoneV3Authenticator extends EventEmitter {
  constructor(credentials) {
    super();

    this.credentials = credentials;
    this.currentToken = null;
  }

  tryFindEndpointUrl(catalog, service, iface, regionId) {
    if (typeof iface === 'undefined') {
      iface = 'public';
    }

    const catalogEntry = catalog.find(x => x.name === service);
    if (!catalogEntry) {
      return null;
    }

    const endpoint = catalogEntry.endpoints.find(x => x.interface === iface && (regionId ? x.region_id == regionId : true));
    if (!endpoint) {
      return null;
    }

    return endpoint.url;
  }

  async getToken() {
    const credentials = this.credentials;
    const model = {
      auth: {
        identity: {
          methods: [
            'password'
          ],
          password: {
            user: {
              name: credentials.username,
              password: credentials.password,
              domain: identify(credentials.domainId, credentials.domainName)
            }
          }
        },
        scope: {
          project: Object.assign(
            identify(credentials.projectId, credentials.projectName),
            { domain: identify(credentials.domainId, credentials.domainName) }
          )
        }
      }
    };

    const response = await axios({
      method: 'POST',
      url: credentials.endpointUrl + '/auth/tokens',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      data: model,
      resolveWithFullResponse: true
    });

    const catalog = response.data.token.catalog;
    const swiftUrl =
      this.tryFindEndpointUrl(catalog, 'swift', credentials.endpointUrlInterface, credentials.regionId)
      || this.tryFindEndpointUrl(catalog, 'radosgw-swift', credentials.endpointUrlInterface, credentials.regionId); // many OpenStack clouds use ceph radosgw to provide swift

    if (!swiftUrl) {
      throw new Error('could not find swift or radosgw-swift service in catalog');
    }

    return {
      token: response.headers['x-subject-token'],
      expires: new Date(response.data.token.expires_at), // expires_at is an ISO 8601 Date:
      swiftUrl: swiftUrl
    };
  }

  async authenticate() {
    if (!this.currentToken) {
      this.currentToken = await this.getToken();
    }

    const tokenPreRefreshInterval = 10000; // renew tokens 10s before they expire
    const requestedTokenExpiry = new Date(Date.now() + tokenPreRefreshInterval);
    if (requestedTokenExpiry > this.currentToken.expires) {
      this.currentToken = await this.getToken();
    }

    const validToken = this.currentToken;
    return { url: validToken.swiftUrl, token: validToken.token };
  }
}

module.exports = KeystoneV3Authenticator;
