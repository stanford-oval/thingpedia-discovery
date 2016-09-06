// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2016 Rakesh Ramesh <rakeshr@cs.stanford.edu>
//
// See COPYING for details

const Q = require('q');

function getBestResult(results, st) {
    // first look for a perfect match
    for (var i = 0; i < results.length; i++) {
        if (st.length !== results[i].kinds.length)
            continue;

        if (st.every(function(u, j) { return 'upnp-' + u === results[i].kinds[j]; }))
            return results[i];
    }

    // first look for a subset match
    for (var i = 0; i < results.length; i++) {
        if (st.every(function(u, j) { return 'upnp-' + u === results[i].kinds[j]; }))
            return results[i];
    }

    // then just pick any device from the list
    // we could further refine the list ranking the UUIDs
    // (to filter overly generic stuff like schemas-upnp-org:device:Basic:1)
    // and picking the one that match the most
    return results[0];
}

function tryWithKind(server, kind) {
    return server.getByAnyKind(kind)
        .then(function(results) {
            return Q.all(results.map(function(d) {
                return server.getAllKinds(d.id).then(function(kinds) {
                    d.kinds = kinds.filter((k) => k.startsWith('upnp-'));
                    d.kinds.sort();
                    return d;
                });
            }));
        });
}

function decode(server, data) {
    // hue does not use the standard UPnP way to discover services and capabilities
	if (data.name.indexOf('hue') >= 0)
		return server.getByPrimaryKind('com.hue');

	if (!Array.isArray(data.st))
        data.st = [];
    data.st = data.st.map(function(u) { return u.toLowerCase().replace(/^urn:/, '').replace(/:/g, '-'); });
    data.st.sort();

    function loop(i) {
        if (i === data.st.length)
            return Q(null);

        return tryWithKind(server, 'upnp-' + data.st[i]).then(function(results) {
            if (results.length > 0)
                return getBestResult(results, data.st);
            else
                return loop(i+1);
        });
    }

    return loop(0);
}

module.exports = {
    decode: decode
}
