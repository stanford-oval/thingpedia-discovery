// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2015 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const Q = require('q');

module.exports = class BaseDiscovery {
    constructor(platform, db, thingpedia) {
        this.platform = platform;
        this.db = db;
        this._client = thingpedia;

        this._inflightRequests = {};
    }

    get isSupported() {
        return true;
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

        console.log('Found new device with descriptor ' + descriptor);

        if (descriptor in this._inflightRequests)
            return;

        this._inflightRequests[descriptor] = this._client.getKindByDiscovery(publicData)
            .then(function(response) {
                console.log('Descriptor ' + descriptor + ' is of kind ' + response);
                return this.db.addFromDiscovery(response, publicData, privateData);
            }.bind(this)).catch(function(e) {
                console.log('Failed to add device from discovery: ' + e.message);
                console.log('Full public data was: ' + JSON.stringify(publicData));
            }).finally(function() {
                delete this._inflightRequests[descriptor];
            }.bind(this));

        this._inflightRequests[descriptor].done();
    }
}
