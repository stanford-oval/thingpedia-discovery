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

        // in loading order
        this._modules = [new BluetoothDiscovery(platform, this)];

        this._isDiscovering = false;
        this._discovering = new Set();
        this._discoveredData = new Map();
        this._discoveredDevices = [];
        this._discoveryCallback = null;
        this._discoveryErrback = null;
    }

    _runDiscoveryModules(timeout, modules) {
        return Q.Promise((callback, errback) => {
            this._discoveryCallback = callback;
            this._discoveryErrback = errback;

            modules.forEach((m) => {
                if (this._discovering.has(m))
                    return;

                this._discovering.add(m);
                m.startDiscovery(timeout).catch(errback).done();
            });
        });
    }

    runDiscovery(timeout, type) {
        this._isDiscovering = true;

        if (type === undefined) {
            return this._runDiscoveryModules(timeout, this._modules);
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
            return this._runDiscoveryModules(timeout, [mod]);
        }
    }

    stopDiscovery() {
        return this._finishDiscovery().then(() => {
            return Q.all(this._modules.map((m) => {
                if (!this._discovering.has(m))
                    return;
                this._discovering.delete(m);
                return m.stopDiscovery();
            }));
        });
    }

    discoveryFinished(mod) {
        console.log('Module ' + mod.type + ' has finished discovering');
        if (!this._discovering.has(mod))
            return;

        this._discovering.delete(mod);
        if (this._discovering.size === 0)
            this._finishDiscovery().done();
    }

    _finishDiscovery() {
        console.log('Discovery done for all modules');
        this._isDiscovering = false;

        var devices = [];
        for (var data of this._discoveredData.entries()) {
            // hack around annoying js closure semantics with var
            // (in an ideal world we would use let, but let is not yet
            // supported by all the js engines we use)
            (() => {
                var descriptor = data[0];
                var publicData = data[1][0];
                var privateData = data[1][1];
                devices.push(this._client.getKindByDiscovery(publicData)
                    .then((response) => {
                        console.log('Descriptor ' + descriptor + ' is of kind ' + response);
                        return this.db.loadFromDiscovery(response, publicData, privateData);
                    }).catch((e) => {
                        console.error('Failed to add device from discovery: ' + e.message);
                        console.log('Full public data was: ' + JSON.stringify(publicData));
                        return null;
                    }));
            })();
        }

        return Q.all(devices).then((devices) => {
            if (this._discoveryCallback)
                this._discoveryCallback(devices.filter((d) => d !== null));
        }, (e) => {
            if (this._discoveryErrback)
                this._discoveryErrback(e);
        }).finally(() => {
            this._discoveredDevices = new Map();
            this._discoveryCallback = null;
            this._discoveryErrback = null;
        });
    }

    _startSequential(modules) {
        function start(i) {
            if (i == modules.length)
                return Q();

            if (modules[i].isSupported) {
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

    _mergeData(oldData, newPublicData, newPrivateData) {
        var oldPublicData = oldData[0];
        var oldPrivateData = oldData[1];

        // replace all private data
        Object.assign(oldPrivateData, newPrivateData);

        // but replace public data only if old public data was lacking
        // (this prevents us from replacing a good uuids array with a null
        // or empty one)
        function isGood(v) {
            if (!v)
                return false;

            if (Array.isArray(v) && v.length === 0)
                return false;

            return true;
        }

        for (var name in newPublicData) {
            var newValue = newPublicData[name];
            var oldValue = oldPublicData[name];

            if (!isGood(oldValue) || isGood(newValue))
                oldPublicData[name] = newValue;
        }
    }

    deviceFound(descriptor, publicData, privateData) {
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

        if (!this._isDiscovering)
            return;

        console.log('Found new device with descriptor ' + descriptor);

        if (this._discoveredData.has(descriptor)) {
            this._mergeData(this._discoveredData.get(descriptor), publicData, privateData);
        } else {
            this._discoveredData.set(descriptor, [publicData, privateData]);
        }
    }
}
