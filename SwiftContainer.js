"use strict";

const axios = require('axios');
const SwiftEntity = require('./SwiftEntity');

class SwiftContainer extends SwiftEntity {
    constructor(containerName, authenticator) {
        super('Object', containerName, authenticator);
    }

    create(name, stream, meta, extra) {

        return this.authenticator.authenticate().then(auth => new Promise((resolve, reject) => {
            const req = axios({
                method: 'PUT',
                url: `${auth.url + this.urlSuffix}/${name}`,
                headers: this.headers(meta, extra, auth.token),
                data: stream,
            }).then(response => {
                if (response.status === 201) {
                    resolve();
                } else {
                    reject(new Error(`HTTP ${response.statusText}(${response.status})`));
                }
            }).catch(err => {
                reject(err);
            });
        }));
    }

    delete(name, when) {
        if (when) {
            const h = {};

            if (when instanceof Date) {
                h['X-Delete-At'] = +when / 1000;
            } else if (typeof when === 'number' || when instanceof Number) {
                h['X-Delete-After'] = when;
            } else {
                throw new Error('expected when to be a number of seconds or a date');
            }

            return this.authenticator.authenticate().then(auth => {
                return axios({
                    method: 'POST',
                    url: `${auth.url + this.urlSuffix}/${name}`,
                    headers: this.headers(null, h, auth.token)
                });
            });

        } else {
            return SwiftEntity.prototype.delete.call(this, name);
        }
    }

    get(name, stream) {
        return this.authenticator.authenticate().then(auth => new Promise((resolve, reject) => {
            axios({
                method: 'GET',
                url: `${auth.url + this.urlSuffix}/${name}`,
                headers: {
                    'x-auth-token': auth.token
                },
                responseType: 'stream'
            }).then((response) => {
              response.data.on('end',  () => {
                resolve();
              });
              response.data.pipe(stream);
            }).catch(err => {
                reject(err);
            });
        }));
    }
}

module.exports = SwiftContainer;
