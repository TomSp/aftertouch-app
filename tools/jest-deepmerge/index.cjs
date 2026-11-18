'use strict';

const merge = require('@fastify/deepmerge')({symbols: true});

// Jest uses the pair and .all APIs without deepmerge's custom merge options.
function deepmerge(target, source, options) {
    if (options !== undefined) {
        throw new TypeError('Custom deepmerge options are not supported by the Jest adapter');
    }
    return merge(target, source);
}

deepmerge.all = function (values, options) {
    if (!Array.isArray(values)) {
        throw new TypeError('Expected an array of configurations');
    }
    return values.reduce((result, value) => deepmerge(result, value, options), {});
};

module.exports = deepmerge;
