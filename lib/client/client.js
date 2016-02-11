// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2015 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details

const Q = require('q');
const events = require('events');
const fs = require('fs');
const lang = require('lang');

const GlobalDeviceManager = require('./global');
const AllJoynDiscovery = require('./alljoyn');
const BluetoothDiscovery = require('./bluetooth');

// a meta-module that collects all modules that deal with discovering,
// creating and maintaining devices (ie, things) on the client (ThingEngine) side

module.exports = new lang.Class({
    Name: 'DiscoveryClient',

    _init: function(db, thingpedia) {
        // in loading order
        this._modules = [new GlobalDeviceManager(db),
                         new AllJoynDiscovery(db, thingpedia),
                         new BluetoothDiscovery(db, thingpedia)];
    },

    _startSequential: function(modules) {
        function start(i) {
            if (i == modules.length)
                return;

            if (modules[i].isSupported) {
                return modules[i].start().then(function() {
                    return start(i+1);
                });
            } else {
                return start(i+1);
            }
        }

        return start(0);
    },

    _stopSequential: function(modules) {
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
    },

    start: function() {
        return this._startSequential(this._modules);
    },

    stop: function() {
        return this._stopSequential(this._modules);
    },
});
