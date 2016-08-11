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
	var descriptor = 'upnp/' + headers['usn'].split('::')[0];
	
	var privateData = {
		// FIXME: Ipv6 addresses not handled
		host : headers['host'].split(':')[0],
		port : headers['host'].split(':')[1],	
		uuid : headers['usn'].split('::')[0],
	};

	var url = headers['location'];
        Tp.Helpers.Http.get(url).then((response) => {
            return Tp.Helpers.Xml.parseString(response);
        }).then((parsed) => {
		var publicData = {
			kind : 'upnp',
			name : parsed.root.device[0].modelName[0],
		    	deviceType : parsed.root.device[0].deviceType[0],
		    	modelUrl : parsed.root.device[0].modelURL[0],
		};
		this.deviceFound(descriptor, publicData, privateData);
	});
    }
}
