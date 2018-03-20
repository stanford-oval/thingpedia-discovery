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

const BaseDiscovery = require('./discovery_base');

module.exports = class BluetoothDiscovery extends BaseDiscovery {
    constructor(platform, master) {
        super(platform, master);

        this._pending = new Set;
        this._discovering = false;
    }

    get isSupported() {
        return this.platform.hasCapability('bluetooth');
    }

    get type() {
        return 'bluetooth';
    }

    startDiscovery(timeout) {
        this._discovering = true;

        setTimeout(() => {
            this._btApi.stopDiscovery();
            this.discoveryFinished();
        }, timeout);

        return Promise.resolve(this._btApi.startDiscovery(timeout));
    }

    stopDiscovery() {
        return Promise.resolve(this._btApi.stopDiscovery());
    }

    start() {
        this._btApi = this.platform.getCapability('bluetooth');

        this._listener = this._deviceDiscovered.bind(this);
        this._btApi.ondeviceadded = this._listener;
        this._btApi.ondevicechanged = this._listener;

        this._btApi.ondiscoveryfinished = () => {
            console.log('Bluetooth discovery done, waiting for SDP probes to complete...');
            this._discovering = false;
            this._maybeFinishDiscovery();
        };

        return this._btApi.start();
    }

    _maybeFinishDiscovery() {
        if (this._discovering)
            return;
        if (this._pending.size > 0)
            return;

        this.discoveryFinished();
    }

    stop() {
        this._btApi.ondeviceadded = null;
        this._btApi.ondevicechanged = null;
        this._btApi.ondiscoveryfinished = null;

        return Promise.resolve(this._btApi.stop());
    }

    _deviceDiscovered(error, btDevice) {
        console.log('Bluetooth device ' + btDevice.address + ' discovered');
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

        if (btDevice.uuids.length === 0 && this._discovering) {
            if (this._pending.has(descriptor)) {
                console.log('Already fetching UUIDs...');
                return;
            }

            console.log('Fetching UUIDs...');
            this._pending.add(descriptor);
            this._btApi.readUUIDs(btDevice.address).catch((e) => {
                console.log('Failed to read UUIDs on BT device ' + btDevice.address + ': ' + e.message);
            }).finally(() => {
                console.log('Fetching UUIDs completed for ' + btDevice.address);
                this._pending.delete(descriptor);

                this.deviceFound(descriptor, publicData, privateData);
                this._maybeFinishDiscovery();
            });
            return;
        }

        this.deviceFound(descriptor, publicData, privateData);
    }
};
