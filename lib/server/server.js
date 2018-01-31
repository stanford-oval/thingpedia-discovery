// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2016 The Board of Trustees of the Leland Stanford Junior University
//
// Author: Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details
"use strict";

const BluetoothDiscovery = require('./bluetooth');
const UpnpDiscovery = require('./upnp');

// a meta-module that collects all server-side modules that deal with discovering

module.exports = class DiscoveryServer {
    constructor(db) {
        this._db = db;

        this._modules = {};
        this._modules['bluetooth'] = BluetoothDiscovery;
        this._modules['upnp'] = UpnpDiscovery;
    }

    decode(data) {
        if (data.kind in this._modules)
            return this._modules[data.kind].decode(this._db, data);
        else
            throw new Error('Not Found');
    }
}
