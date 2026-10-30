'use strict';

// Locks the contract of the in-house query-string replacement in
// SwiftEntity.js. The expectations below were captured from
// query-string@6.14.1 (the version this package used to depend on) so a
// future refactor cannot silently change the URLs `list()` builds.
//
// Unlike test/client.js this needs no Swift service, so it runs anywhere.

const expect = require('chai').expect;
const fs = require('fs');

// SwiftEntity.js keeps the helpers module-private; lift them out rather
// than widening the package's public surface just for a test.
const source = fs.readFileSync(require.resolve('../SwiftEntity.js'), 'utf8');
const helpers = source.slice(
  source.indexOf('function strictEncode'),
  source.indexOf('class SwiftEntity')
);
// eslint-disable-next-line no-new-func
const stringifyQuery = new Function(`${helpers}; return stringifyQuery;`)();

describe('stringifyQuery', function () {
  it('renders the shapes SwiftContainer.list() actually passes', function () {
    expect(stringifyQuery({ delimiter: '/', prefix: 'sub/' }))
      .to.equal('delimiter=%2F&prefix=sub%2F');
    expect(stringifyQuery({ limit: 1000, marker: 'last object' }))
      .to.equal('limit=1000&marker=last%20object');
  });

  it('sorts keys so insertion order cannot change the URL', function () {
    expect(stringifyQuery({ prefix: 'a', delimiter: '/' }))
      .to.equal(stringifyQuery({ delimiter: '/', prefix: 'a' }));
    expect(stringifyQuery({ b: '2', a: '1', c: '3' })).to.equal('a=1&b=2&c=3');
  });

  it('encodes spaces as %20 rather than +', function () {
    expect(stringifyQuery({ prefix: 'a b c' })).to.equal('prefix=a%20b%20c');
  });

  it('escapes the sub-delims encodeURIComponent leaves alone', function () {
    expect(stringifyQuery({ prefix: 'x!y\'z()*' }))
      .to.equal('prefix=x%21y%27z%28%29%2A');
  });

  it('keeps empty strings but omits undefined values', function () {
    expect(stringifyQuery({ prefix: '' })).to.equal('prefix=');
    expect(stringifyQuery({ prefix: undefined })).to.equal('');
    expect(stringifyQuery({ prefix: undefined, limit: 5 })).to.equal('limit=5');
  });

  it('renders null as a bare key with no =', function () {
    expect(stringifyQuery({ prefix: null })).to.equal('prefix');
    expect(stringifyQuery({ prefix: null, limit: 5 })).to.equal('limit=5&prefix');
  });

  it('repeats a key once per array element', function () {
    expect(stringifyQuery({ prefix: ['a', 'b'] })).to.equal('prefix=a&prefix=b');
    expect(stringifyQuery({ prefix: ['a b', 'c/d'] }))
      .to.equal('prefix=a%20b&prefix=c%2Fd');
    expect(stringifyQuery({ prefix: [] })).to.equal('');
  });

  it('handles non-string scalars and the empty object', function () {
    expect(stringifyQuery({ limit: 0 })).to.equal('limit=0');
    expect(stringifyQuery({ newest: true })).to.equal('newest=true');
    expect(stringifyQuery({})).to.equal('');
  });

  it('percent-encodes non-ASCII keys and values', function () {
    expect(stringifyQuery({ prefix: 'ä' })).to.equal('prefix=%C3%A4');
    expect(stringifyQuery({ 'a b': 'c' })).to.equal('a%20b=c');
  });
});
