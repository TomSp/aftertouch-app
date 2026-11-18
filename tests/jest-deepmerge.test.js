const {createRequire} = require('node:module');
const {mergeConfig} = require('jest-config');

const requireFromJest = createRequire(require.resolve('jest-config'));
const deepmerge = requireFromJest('deepmerge');

describe('Jest configuration merge security', () => {
    it('uses the maintained merger adapter for the installed Jest dependency', () => {
        expect(requireFromJest('deepmerge/package.json').name).toBe('@aftertouch/jest-deepmerge');
    });

    it.each(['target', 'source'])('rejects prototype keys in the %s, including nested objects and arrays', (side) => {
        const malicious = JSON.parse('{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"prototype":{"polluted":true},"nested":{"__proto__":{"polluted":true}},"items":[{"__proto__":{"polluted":true},"safe":1}]}');
        const result = side === 'target' ? deepmerge(malicious, {}) : deepmerge({}, malicious);

        for (const object of [result, result.nested, result.items[0]]) {
            expect(Object.getPrototypeOf(object)).toBe(Object.prototype);
            expect(object.polluted).toBeUndefined();
            for (const key of ['__proto__', 'constructor', 'prototype']) {
                expect(Object.hasOwn(object, key)).toBe(false);
            }
        }
        expect(result.items[0].safe).toBe(1);
        expect({}.polluted).toBeUndefined();
    });

    it('merges Jest configurations and concatenates arrays without mutating inputs', () => {
        const defaults = {globals: {feature: {enabled: true}}, setupFiles: [{name: 'preset'}]};
        const overrides = {globals: {feature: {mode: 'test'}}, setupFiles: [{name: 'project'}]};
        const merged = mergeConfig(defaults, overrides);

        expect(merged).toEqual({
            globals: {feature: {enabled: true, mode: 'test'}},
            setupFiles: [{name: 'preset'}, {name: 'project'}]
        });
        merged.globals.feature.enabled = false;
        merged.setupFiles[0].name = 'changed';
        merged.setupFiles[1].name = 'changed';
        expect(defaults.globals.feature.enabled).toBe(true);
        expect(defaults.setupFiles[0].name).toBe('preset');
        expect(overrides.setupFiles[0].name).toBe('project');
    });

    it('preserves symbols, explicit undefined values, functions, dates and regular expressions', () => {
        const key = Symbol('config');
        const callback = () => true;
        const date = new Date(0);
        const pattern = /test/;
        const merged = deepmerge({value: 1}, {value: undefined, [key]: {enabled: true}, callback, date, pattern});

        expect(Object.hasOwn(merged, 'value')).toBe(true);
        expect(merged.value).toBeUndefined();
        expect(merged[key]).toEqual({enabled: true});
        expect(merged.callback).toBe(callback);
        expect(merged.date).toBe(date);
        expect(merged.pattern).toBe(pattern);
    });

    it('merges empty and multiple configuration lists with later values taking precedence', () => {
        expect(deepmerge.all([])).toEqual({});
        expect(deepmerge.all([{value: 1}, {value: 2}, {value: 3}])).toEqual({value: 3});
        expect(deepmerge({items: [1]}, {items: {enabled: true}})).toEqual({items: {enabled: true}});
    });

    it('rejects invalid list input and unsupported merge options', () => {
        expect(() => deepmerge.all({})).toThrow(TypeError);
        expect(() => deepmerge({}, {}, {clone: false})).toThrow(TypeError);
        expect(() => deepmerge.all([{}], {clone: false})).toThrow(TypeError);
    });
});
