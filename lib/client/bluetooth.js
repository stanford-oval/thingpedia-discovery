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

    start() {
        this._btApi = this.platform.getCapability('bluetooth');

        this._listener = this._deviceDiscovered.bind(this);
        this._btApi.on('device-added', this._listener);
        this._btApi.on('device-changed', this._listener);

        return this._btApi.start();
    }

    stop() {
        this._btApi.removeListener('device-added', this._listener);
        this._btApi.removeListener('device-changed', this._listener);

        return Q();
    }

    _deviceDiscovered(btApiId, btDevice) {
        var descriptor = 'bluetooth/' + btDevice.address;
        var publicData = {
            kind: 'bluetooth',
            uuids: btDevice.uuids,
            class: btDevice.class
        };
        var privateData = {
            address: btDevice.address,
            alias: btDevice.alias,
            paired: btDevice.paired,
            trusted: btDevice.trusted
        };

        this.deviceFound(descriptor, publicData, privateData);
    }
}
