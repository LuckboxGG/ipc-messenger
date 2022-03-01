import {
  makeInstance,
  makeRoom,
  makeMessage,
  makeMessageWithoutSender,
} from '../IPCMessenger';

describe('makeInstance', () => {
  it.each([
    '', 'i:',
  ])('should throw TypeError when calling with %s', (instance) => {
    expect(() => makeInstance(instance)).toThrow(TypeError);
  });

  it.each([
    'valid-instance', 'another_valid_instance',
  ])('should return the value calling with %s', (instance) => {
    expect(makeInstance(instance)).toEqual(instance);
  });
});

describe('makeRoom', () => {
  it.each([
    '', 'i:',
  ])('should throw TypeError when calling with %s', (room) => {
    expect(() => makeRoom(room)).toThrow(TypeError);
  });

  it.each([
    'valid-room', 'another_valid_room',
  ])('should return the value calling with %s', (room) => {
    expect(makeRoom(room)).toEqual(room);
  });
});

describe('makeMessage', () => {
  it.each([
    '', null, {},
    { type: 'unknown' },
    { type: 'message-without-serializable-data', sender: 'someone', data: [new Map()] },
    { type: 'message-without-serializable-data', sender: 'someone', data: { key: 'valid-value', map: new Map([['invalid', 'value']]) } },
  ])('should throw TypeError when calling with %s', (message) => {
    expect(() => makeMessage(message)).toThrow(TypeError);
  });

  it.each([
    { type: 'leave', sender: 'someone' },
    { type: 'handover', sender: 'someone' },
    { type: 'handover', sender: 'someone', data: {} },
  ])('should return the value calling with %s', (message) => {
    expect(makeMessage(message)).toEqual(message);
  });
});

describe('makeMessageWithoutSender', () => {
  it.each([
    '', null, {},
    { type: '' },
    { type: 'message-without-serializable-data', data: new Map() },
    { type: 'message-without-serializable-data', data: [new Map()] },
    { type: 'message-without-serializable-data', data: { key: 'valid-value', map: new Map([['invalid', 'value']]) } },
  ])('should throw TypeError when calling with %s', (message) => {
    expect(() => makeMessageWithoutSender(message)).toThrow(TypeError);
  });

  it.each([
    { type: 'leave' },
    { type: 'handover' },
    { type: 'handover', data: {} },
  ])('should return the value calling with %s', (message) => {
    expect(makeMessageWithoutSender(message)).toEqual(message);
  });
});
