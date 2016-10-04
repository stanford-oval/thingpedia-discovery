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
const Client = require('node-ssdp').Client;
const Tp = require('thingpedia');
const Url = require('url');

const BaseDiscovery = require('./discovery_base');

module.exports = class UpnpDiscovery extends BaseDiscovery {
    constructor(platform, master) {
        super(platform, master);
    	this._client = new Client();
        this._pending = new Set;
    }

    get isSupported() {
        return true;
    }

    get type() {
        return 'upnp';
    }

    startDiscovery(timeout) {
        this._client.search('ssdp:all');
        setTimeout(() => {
            this.discoveryFinished();
	    }, timeout);
        return Q();
    }

    stopDiscovery() {
        this._client.stop();
        return Q();
    }

    start() {
	    this._client.on('response', this._deviceDiscovered.bind(this));
        return Q();
    }

    stop() {
        return Q();
    }

    _deviceDiscovered(headers, statusCode, rinfo) {
        //console.log('UPNP response', headers);
        if (!headers['USN'])
            return;

        var splitUSN = headers['USN'].split('::');
        var uuid = splitUSN[0];
        var descriptor = 'upnp/' + uuid;

        var parsedLocation = Url.parse(headers['LOCATION']);
        var privateData = {
            host: parsedLocation.hostname,
            port: parsedLocation.post || 80,
            uuid: uuid,
        };

        var url = headers['LOCATION'];
        Tp.Helpers.Http.get(url).then((response) => {
            return Tp.Helpers.Xml.parseString(response);
        }).then((parsed) => {
            var publicData = {
                kind: 'upnp'
            };
            var device = parsed.root.device[0];
            if (!device)
                return;
            if (device.modelName)
                publicData.name = device.modelName[0];
            else
                publicData.name = '';
            if (device.deviceType)
                publicData.deviceType = device.deviceType[0];
            else
                publicData.deviceType = '';
            if (device.modelURL)
                publicData.modelUrl = device.modelURL[0];
            else
                publicData.modelUrl = null;
            if (device.serviceList && device.serviceList[0] && device.serviceList[0].service)
                publicData.st = device.serviceList[0].service.map((s) => s.serviceType[0]);
            else
                publicData.st = [];
            this.deviceFound(descriptor, publicData, privateData);
        }).catch((e) => {
            console.error('Failed to read description.xml from UPnP device: ' + e.message);
        }).done();
    }
}
