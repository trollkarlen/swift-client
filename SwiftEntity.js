'use strict';

const axios = require('axios');

// Percent-encode a single component the way `query-string` did (it used
// strict-uri-encode, which also escapes the sub-delims !'()* that
// encodeURIComponent leaves alone).
function strictEncode(value) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

// Drop-in replacement for `query-string@6`'s `stringify()` with default
// options, kept so `list()` builds byte-identical URLs. query-string was
// dropped as a dependency because it pulls in decode-uri-component, which
// has two unfixable high-severity DoS advisories (GHSA-vcc3-ghjq-m6fr,
// GHSA-qr28-fpjm-wq7f) and no patched release; query-string only became
// free of it in 10.0.0, which is ESM-only and so unusable from CommonJS.
//
// Replicated behaviour: keys sorted alphabetically, `undefined` values
// omitted entirely, `null` rendered as a bare key with no `=`, arrays
// repeated once per element, spaces as %20 (not `+`).
function stringifyQuery(query) {
  return Object.keys(query)
    .sort()
    .map(key => {
      const value = query[key];

      if (value === undefined) return '';
      if (value === null) return strictEncode(key);
      if (Array.isArray(value)) {
        return value
          .filter(item => item !== undefined)
          .map(item => (item === null
            ? strictEncode(key)
            : `${strictEncode(key)}=${strictEncode(item)}`))
          .join('&');
      }

      return `${strictEncode(key)}=${strictEncode(value)}`;
    })
    .filter(part => part !== '')
    .join('&');
}

class SwiftEntity {
  constructor(childName, urlSuffix, authenticator) {
    this.childName = childName;
    this.urlSuffix = urlSuffix ? `/${urlSuffix}` : '';
    this.authenticator = authenticator;
  }

  list(extra, query) {
    const querystring = query ? '?' + stringifyQuery(query) : '';
    return this.authenticator.authenticate().then(auth => { return axios({
      url: auth.url + this.urlSuffix + querystring,
      headers: this.headers(null, extra, auth.token),
      json: true
    }).then((response) => response.data); });
  }

  update(name, meta, extra) {
    return this.authenticator.authenticate().then(auth => axios({
      method: 'POST',
      url: `${auth.url + this.urlSuffix}/${name}`,
      headers: this.headers(meta, extra, auth.token)
    }).then((response) => response.data));
  }

  meta(name) {
    return this.authenticator.authenticate().then(auth => axios({
      method: 'HEAD',
      url: `${auth.url + this.urlSuffix}/${name}`,
      headers: this.headers(null, null, auth.token),
      resolveWithFullResponse: true
    }).then(response => {
      const meta = {};
      const headers = response.headers;
      const regex = new RegExp(`^X-${this.childName}-Meta-(.*)$`, 'i');

      for (const k in headers) {
        const m = k.match(regex);
        if (m) {
          meta[m[1]] = headers[k];
        }
      }

      return meta;
    }));
  }

  delete(name) {
    return this.authenticator.authenticate().then(auth => axios({
      method: 'DELETE',
      url: `${auth.url + this.urlSuffix}/${name}`,
      headers: this.headers(null, null, auth.token)
    }));
  }

  headers(meta, extra, token) {
    const headers = Object.assign({
      'accept': 'application/json',
      'x-auth-token': token
    }, extra);

    if (meta != null) {
      for (const k in meta) {
        if (Object.prototype.hasOwnProperty.call(meta, k)) {
          headers[`X-${this.childName}-Meta-${k}`] = meta[k];
        }
      }
    }

    return headers;
  }
}

module.exports = SwiftEntity;
