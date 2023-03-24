'use strict';

const expect = require('chai').expect;
const fs = require('fs');
const stream = require('stream');
const SwiftClient = require('../index');

const credentials = require('./credentials.ksv3.json');

describe('SwiftClient', function () {
  this.timeout(4000);

  var client;

  before(function () {
    client = new SwiftClient(new SwiftClient.KeystoneV3Authenticator(credentials));
    return client.create('swift-client-test');
  });


  describe('#list', function() {
    it('should get a list of containers', function() { return client.list()
      .then(containers => {
        expect(containers).to.be.instanceof(Array);

        const container = containers.filter((x) => x.name === 'swift-client-test')[0];
        expect(container).to.exist;
        expect(container.count).to.equal(0);
        expect(container.bytes).to.equal(0);
      }); });
  });


  describe('#create', function() {
    it('should create a container', function() { return client.create('swift-client-test-2')
      .then(() => client.list())
      .then(containers => {
        expect(containers.filter((x) => x.name === 'swift-client-test-2')).to.have.length(1);
        return client.delete('swift-client-test-2');
      }); });
  });


  describe('#update', function() {
    it('should update the metadata', function() { return client.update('swift-client-test', { colour: 'orange' })
      .then(() => client.meta('swift-client-test'))
      .then(meta => {
        expect(meta).to.eql({
          colour: 'orange'
        });
      }); });
  });


  describe('SwiftContainer', function() {
    let container;

    before(function() {
      container = client.container('swift-client-test');

      const s1 = fs.createReadStream('test/test1.txt');
      const s2 = fs.createReadStream('test/test2.txt');
      return container.create('test.txt', s1)
        .then(() => container.create('sub/test.txt', s2));
    });

    after(function() {
      container.delete('test.txt');
      return container.delete('sub/test.txt');
    });

    describe('#list', function() {
      it('should return a list of objects', function() { return container.list()
        .then(objects => {
          expect(objects).to.have.length(2);
          expect(objects[0].name).to.equal('sub/test.txt');
          expect(objects[1].name).to.equal('test.txt');
        }); });
      it('should return a pseudo-directory content',
        function() { return container.list(null, {delimiter: '/', prefix: 'sub/'})
          .then(objects => {
            expect(objects).to.have.length(1);
            expect(objects[0].name).to.equal('sub/test.txt');
          }); });
    });

    describe('#get', function() {
      it('should get the object', function() {
        const s = new stream.Writable();
        let text = '';

        s._write = chunk => {
          text += chunk.toString();
        };

        return container.get('test.txt', s)
          .then(() => {
            expect(text).to.equal('Hello, world!\n');
          });
      });
    });

    describe('#get 404', function() {
      it('should not get the object', async function() {
        const s = new stream.Writable();

        await expect(container.get('test123.txt', s)).to.be.rejectedWith('Request failed with status code 404');
      });
    });

    describe('#update', function() {
      it('should update the metadata', function() { return container.update('test.txt', { colour: 'orange' })
        .then(() => container.meta('test.txt'))
        .then(meta => {
          expect(meta).to.eql({
            colour: 'orange'
          });
        }); });
    });
  });

  after(function() { return client.delete('swift-client-test'); });
});
