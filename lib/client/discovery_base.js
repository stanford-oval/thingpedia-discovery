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

module.exports = class BaseDiscovery extends events.EventEmitter {
    constructor(platform, master) {
        this.platform = platform;
        this._master = master;
    }

    get isSupported() {
        return true;
    }

    discoveryFinished() {
        this.master.discoveryFinished(this);
    }

    deviceFound(descriptor, publicData, privateData) {
        this.master.deviceFound(descriptor, publicData, privateData);
    }
}
