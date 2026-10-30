'use strict';

// Regression guard for the Keystone auth request body.
//
// v2.3.3 ("add eslint and fix eslint issues") changed the body from omitting
// absent fields to sending them as explicit nulls:
//     domain: { id: credentials.domainId || null, name: credentials.domainName || null }
// Real Keystone rejects that with HTTP 400 ("None is not of type 'string'"),
// so every deployment configured with ids only -- OS_PROJECT_ID plus
// OS_PROJECT_DOMAIN_ID and no names, which is the common case -- lost all
// Swift access. The fork's integration suite did not catch it because the
// test Keystone is lenient and its fixture supplies names.
//
// These tests assert the body shape directly, with no server involved.

const expect = require('chai').expect;
const SwiftClient = require('../index');

describe('KeystoneV3Authenticator auth body', function () {
  // Reach the body the same way getToken does, without a network call.
  function body(credentials) {
    const axios = require('axios');
    const originalDefaults = axios.defaults.adapter;
    let sent = null;
    axios.defaults.adapter = async config => {
      sent = JSON.parse(config.data);
      return {
        status: 201,
        statusText: 'Created',
        headers: { 'x-subject-token': 'tok' },
        data: { token: { expires_at: new Date(Date.now() + 3600000).toISOString(), catalog: [] } },
        config
      };
    };
    const auth = new SwiftClient.KeystoneV3Authenticator(credentials);
    return auth.getToken()
      .then(() => sent, () => sent)
      .then(result => { axios.defaults.adapter = originalDefaults; return result; });
  }

  const base = {
    endpointUrl: 'http://keystone.invalid/v3',
    username: 'tester',
    password: 'secret'
  };

  function assertNoNulls(value, path) {
    if (value === null) throw new Error(`null at ${path} -- Keystone returns 400 for this`);
    if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) assertNoNulls(v, `${path}.${k}`);
    }
  }

  it('sends ids only when configured with ids (the wcib shape)', function () {
    return body(Object.assign({}, base, { projectId: 'p-id', domainId: 'd-id' }))
      .then(sent => {
        expect(sent).to.not.equal(null);
        assertNoNulls(sent, 'auth');
        expect(sent.auth.identity.password.user.domain).to.deep.equal({ id: 'd-id' });
        expect(sent.auth.scope.project.id).to.equal('p-id');
        expect(sent.auth.scope.project).to.not.have.property('name');
        expect(sent.auth.scope.project.domain).to.deep.equal({ id: 'd-id' });
      });
  });

  it('sends names only when configured with names', function () {
    return body(Object.assign({}, base, { projectName: 'proj', domainName: 'Default' }))
      .then(sent => {
        assertNoNulls(sent, 'auth');
        expect(sent.auth.identity.password.user.domain).to.deep.equal({ name: 'Default' });
        expect(sent.auth.scope.project.name).to.equal('proj');
        expect(sent.auth.scope.project).to.not.have.property('id');
      });
  });

  it('prefers the id when both an id and a name are configured', function () {
    return body(Object.assign({}, base, {
      projectId: 'p-id', projectName: 'proj', domainId: 'd-id', domainName: 'Default'
    })).then(sent => {
      assertNoNulls(sent, 'auth');
      expect(sent.auth.scope.project).to.not.have.property('name');
      expect(sent.auth.scope.project.id).to.equal('p-id');
      expect(sent.auth.identity.password.user.domain).to.deep.equal({ id: 'd-id' });
    });
  });

  it('omits the reference entirely when neither is configured', function () {
    return body(base).then(sent => {
      assertNoNulls(sent, 'auth');
      expect(sent.auth.identity.password.user.domain).to.deep.equal({});
      expect(sent.auth.scope.project.domain).to.deep.equal({});
    });
  });
});
