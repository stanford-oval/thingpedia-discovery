// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2015 Giovanni Campagna <gcampagn@cs.stanford.edu>
//
// See COPYING for details

const Q = require('q');

function arrayEqual(one, two) {
    if (one.length !== two.length)
        return false;

    if (!one.every(function(e, i) { return two[i] === e; }))
        return false;

    return true;
}

function getBestResult(results, uuids) {
    // first look for a perfect match
    for (var i = 0; i < results.length; i++) {
        if (uuids.length !== results[i].kinds.length)
            continue;

        if (uuids.every(function(u, j) { return 'bluetooth-uuid-' + u === results[i].kinds[j]; }))
            return results[i];
    }

    // first look for a subset match
    for (var i = 0; i < results.length; i++) {
        if (uuids.every(function(u, j) { return 'bluetooth-uuid-' + u === results[i].kinds[j]; }))
            return results[i];
    }

    // then just pick any device from the list
    // we could further refine the list ranking the UUIDs
    // (to filter overly generic stuff like OBEX)
    // and picking the one that match the most
    return results[0];
}

function tryWithKind(server, kind) {
    return server.getByAnyKind(kind)
        .then(function(results) {
            return Q.all(results.map(function(d) {
                return server.getAllKinds(d.id).then(function(kinds) {
                    d.kinds = kinds.filter((k) => k.startsWith('bluetooth-uuid-'));
                    d.kinds.sort();
                    return d;
                });
            }));
        });
}

function decodeClass(btClass) {
    var devicePart = btClass & 0x1FFF;

    switch (devicePart) {
    case 0x00000900:
        return 'bluetooth-class-health';

    case 0x00000400:
        return 'bluetooth-class-audio-video';

    case 0x00000200:
        return 'bluetooth-class-phone';

    default:
        // anything else lacks defined profiles and is essentially useless
        return null;
    }
}

function decode(server, data) {
    if (typeof data.class !== 'number' ||
        typeof data.uuids !== 'object')
        return Q(null); // malformed

    if (!Array.isArray(data.uuids))
        data.uuids = [];
    data.uuids = data.uuids.map(function(u) { return u.toLowerCase(); });
    data.uuids.sort();

    function loop(i) {
        if (i === data.uuids.length)
            return Q(null);

        return tryWithKind(server, 'bluetooth-uuid-' + data.uuids[i]).then(function(results) {
            if (results.length > 0)
                return getBestResult(results, data.uuids);
            else
                return loop(i+1);
        });
    }

    return loop(0).then(function(result) {
        if (result !== null) {
            return result;
        } else {
            var classKind = decodeClass(data.class);
            if (classKind === null)
                return null;
            return tryWithKind(server, classKind).then(function(results) {
                if (results.length === 0)
                    return null;
                else
                    return getBestResult(results, data.uuids);
            });
        }
    }).then(function(result) {
        if (result !== null)
            return result;
        else
            return server.getByPrimaryKind('org.thingpedia.builtin.bluetooth.generic');
    });
}

module.exports = {
    decode: decode
}
