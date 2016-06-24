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

const BaseDiscovery = require('./discovery_base');

module.exports = class BluetoothDiscovery extends BaseDiscovery {
    get isSupported() {
        return this.platform.hasCapability('bluetooth');
    }

    get type() {
        return 'bluetooth';
    }

    startDiscovery(timeout) {
        return this._btApi.startDiscovery(timeout);
    }

    stopDiscovery() {
        return this._btApi.stopDiscovery();
    }

    start() {
        this._btApi = this.platform.getCapability('bluetooth');

        this._listener = this._deviceDiscovered.bind(this);
        this._btApi.ondeviceadded = this._listener;
        this._btApi.ondevicechanged = this._listener;

        this._btApi.ondiscoveryfinished = () => {
            this.discoveryFinished();
        }

        return this._btApi.start();
    }

    stop() {
        this._btApi.ondeviceadded = null;
        this._btApi.ondevicechanged = null;
        this._btApi.ondiscoveryfinished = null;

        return this._btApi.stop();
    }

    _deviceDiscovered(error, btDevice) {
        var descriptor = 'bluetooth/' + btDevice.address;
        var publicData = {
            kind: 'bluetooth',
            uuids: btDevice.uuids,
            class: btDevice.class
        };
        var privateData = {
            address: btDevice.address,
            alias: btDevice.alias,
            paired: btDevice.paired
        };

        this.deviceFound(descriptor, btDevice.paired, publicData, privateData);
    }
}
