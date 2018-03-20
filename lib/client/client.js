// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2015 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const events = require('events');

const BluetoothDiscovery = require('./bluetooth');
const UpnpDiscovery = require('./upnp');

module.exports = class DiscoveryClient extends events.EventEmitter {
    constructor(platform, db, thingpedia) {
        super();

        this.db = db;
        this._client = thingpedia;
        this._delegate = null;

        // in loading order
        this._modules = [new BluetoothDiscovery(platform, this),
                         new UpnpDiscovery(platform, this)];

        this._isDiscovering = false;
        this._discovering = new Set();
        this._discoveredData = new Map();
        this._discoveredDevices = [];
        this._discoveryCallback = null;
        this._discoveryErrback = null;
    }

    _runDiscoveryModules(timeout, modules) {
        return new Promise((callback, errback) => {
            this._discoveryCallback = callback;
            this._discoveryErrback = errback;

            modules.forEach((m) => {
                if (this._discovering.has(m))
                    return;
                if (!m.isSupported)
                    return;

                this._discovering.add(m);
                m.startDiscovery(timeout).catch(errback);
            });
        });
    }

    runDiscovery(timeout, type) {
        this._isDiscovering = true;

        if (type === undefined || type === null) {
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
                throw new TypeError('Invalid discovery type ' + type);
            return this._runDiscoveryModules(timeout, [mod]);
        }
    }

    stopDiscovery() {
        return this._finishDiscovery().then(() => {
            return Promise.all(this._modules.map((m) => {
                if (!this._discovering.has(m))
                    return Promise.resolve();
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
            this._finishDiscovery();
    }

    _finishDiscovery() {
        console.log('Discovery done for all modules');
        this._isDiscovering = false;

        const devices = [];
        for (const [descriptor, [publicData, privateData]] of this._discoveredData.entries()) {
            devices.push(this._client.getKindByDiscovery(publicData).then((response) => {
                console.log('Descriptor ' + descriptor + ' is of kind ' + response);
                return this.db.loadFromDiscovery(response, publicData, privateData);
            }).catch((e) => {
                if (e.code === 404)
                    console.log('Could not find a device in Thingpedia compatible with ' + descriptor);
                else
                    console.error('Failed to add device from discovery: ' + e.message);
                console.log('Full public data was: ' + JSON.stringify(publicData));
                return null;
            }));
        }

        return Promise.all(devices).then((devices) => {
            if (this._discoveryCallback)
                this._discoveryCallback(devices.filter((d) => d !== null));
        }, (e) => {
            if (this._discoveryErrback)
                this._discoveryErrback(e);
        }).then(() => {
            this._discoveredDevices = new Map();
            this._discoveryCallback = null;
            this._discoveryErrback = null;
        });
    }

    _startSequential(modules) {
        function start(i) {
            if (i === modules.length)
                return Promise.resolve();

            if (modules[i].isSupported) {
                return modules[i].start().then(() => {
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
                return Promise.resolve();

            if (modules[i].isSupported) {
                return modules[i].stop().then(() => {
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

        if (this._discoveredData.has(descriptor))
            this._mergeData(this._discoveredData.get(descriptor), publicData, privateData);
        else
            this._discoveredData.set(descriptor, [publicData, privateData]);
    }
};