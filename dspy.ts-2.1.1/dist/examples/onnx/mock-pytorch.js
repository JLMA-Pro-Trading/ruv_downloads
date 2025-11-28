"use strict";
// Mock implementation of js-pytorch for testing
Object.defineProperty(exports, "__esModule", { value: true });
exports.load = exports.device = exports.tensor = exports.nn = void 0;
// Mock implementation of js-pytorch for testing
exports.nn = {
    Linear: jest.fn().mockImplementation((inputSize, outputSize) => ({
        inputSize,
        outputSize,
        forward: jest.fn().mockImplementation(x => x),
        to: jest.fn(),
        eval: jest.fn(),
        copy_: jest.fn()
    })),
    ReLU: jest.fn().mockImplementation(() => ({
        forward: jest.fn().mockImplementation(x => x),
        to: jest.fn(),
        eval: jest.fn()
    }))
};
exports.tensor = jest.fn().mockImplementation((data, options) => ({
    shape: Array.isArray(data) ? [data.length] : [data.byteLength / 4],
    dataSync: jest.fn().mockReturnValue(Array.isArray(data) ? new Float32Array(data) : data),
    add: jest.fn().mockReturnValue((0, exports.tensor)([0])),
    pow: jest.fn().mockReturnValue((0, exports.tensor)([0])),
    sum: jest.fn().mockReturnValue((0, exports.tensor)([0])),
    backward: jest.fn(),
    relu: jest.fn().mockReturnValue((0, exports.tensor)([0])),
    to: jest.fn().mockReturnValue((0, exports.tensor)([0])),
    copy_: jest.fn()
}));
exports.device = jest.fn().mockImplementation((type) => ({ type }));
exports.load = jest.fn().mockImplementation(async (path) => ({}));
//# sourceMappingURL=mock-pytorch.js.map