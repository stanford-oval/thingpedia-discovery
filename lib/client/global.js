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
const lang = require('lang');

//const KINDS = ['sportradar', 'weather'];
const KINDS = ['us.sportradar'];

// A device discovery client that handles always available devices with no authentication
module.exports = class GlobalDeviceManager {
    constructor(devices) {
        this._devices = devices;
    }

    get isSupported() {
        return true;
    }

    start() {
        return Q.all(KINDS.map(function(k) {
            return this._devices.loadOneDevice({ kind: k }, false);
        }, this));
    }

    stop() {
        return Q();
    }
}
