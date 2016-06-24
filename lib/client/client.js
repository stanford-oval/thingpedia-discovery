// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2015 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const Q = require('q');
const events = require('events');
const fs = require('fs');

const BluetoothDiscovery = require('./bluetooth');

module.exports = class DiscoveryClient extends events.EventEmitter {
    constructor(platform, db, thingpedia) {
        super();

        this.db = db;
        this._client = thingpedia;
        this._delegate = null;

        this._inflightRequests = {};

        // in loading order
        this._modules = [new BluetoothDiscovery(platform, this)];
    }

    runDiscovery(timeout, type) {
        if (type === undefined) {
            return Q.all(this._modules.map(function(m) {
                return m.runDiscovery(timeout);
            }));
        } else {
            var mod = null;
            for (var m of this._modules) {
                if (m.type === type) {
                    mod = m;
                    break;
                }
            }
            if (!mod)
                return;
            return mod.runDiscovery(timeout);
        }
    }

    stopDiscovery() {
        this._delegate = null;
        return Q.all(this._modules.map(function(m) {
            return m.stopDiscovery();
        }));
    }

    _startSequential(modules) {
        function start(i) {
            if (i == modules.length)
                return;

            if (modules[i].isSupported) {
                modules[i].on('device-discovered', (d) => this.emit)
                return modules[i].start().then(function() {
                    return start(i+1);
                });
            } else {
                return start(i+1);
            }
        }

        return start(0);
    }

    _stopSequential(modules) {
        function stop(i) {
            if (i < 0)
                return Q();

            if (modules[i].isSupported) {
                modules[i].on('device-discovered', this.emit.bind(this, 'device-discovered'));
                return modules[i].stop().then(function() {
                    return stop(i-1);
                });
            } else {
                return stop(i-1);
            }
        }

        return stop(modules.length-1);
    }

    start() {
        return this._startSequential(this._modules);
    }

    stop() {
        return this._stopSequential(this._modules);
    }

    deviceFound(descriptor, ready, publicData, privateData) {
        var existing = this.db.getDeviceByDescriptor(descriptor);

        if (existing) {
            try {
                console.log('Updating device with descriptor ' + descriptor);
                existing.updateFromDiscovery(publicData, privateData);
                return;
            } catch(e) {
                console.log('Updating device from discovery failed, removing...');
                this.db.removeDevice(existing);
            }
        }

        console.log('Found new device with descriptor ' + descriptor);

        if (descriptor in this._inflightRequests)
            return;

        this._inflightRequests[descriptor] = this._client.getKindByDiscovery(publicData)
            .then(function(response) {
                console.log('Descriptor ' + descriptor + ' is of kind ' + response);
                return this.db.loadFromDiscovery(response, publicData, privateData, this._delegate);
            }).then((device) => {
                if (this._delegate)
                    this._delegate.deviceFound(device);
            }).catch(function(e) {
                console.error('Failed to add device from discovery: ' + e.message);
                console.log('Full public data was: ' + JSON.stringify(publicData));
            }).finally(function() {
                delete this._inflightRequests[descriptor];
            }.bind(this));

        this._inflightRequests[descriptor].done();
    }
}
