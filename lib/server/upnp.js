// -*- mode: js; indent-tabs-mode: nil; js-basic-offset: 4 -*-
//
// This file is part of ThingEngine
//
// Copyright 2016 Rakesh Ramesh <rakeshr@cs.stanford.edu>
//
// See COPYING for details

const Q = require('q');

function decode(server, data) {
	if(data.name.indexOf('hue') >= 0)
		return server.getByPrimaryKind('com.hue');
	else
		return null;
}

module.exports = {
    decode: decode
}
