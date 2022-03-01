import {
  makeInstance,
  makeRoom,
  makeMessage,
  makeMessageWithoutSender,
  MessageTypes,
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
    { type: MessageTypes.Handover, state: 'not-an-obj' },
  ])('should throw TypeError when calling with %s', (message) => {
    expect(() => makeMessage(message)).toThrow(TypeError);
  });

  it.each([
    { type: MessageTypes.Leave, sender: 'someone' },
    { type: MessageTypes.Handover, sender: 'someone' },
    { type: MessageTypes.Handover, sender: 'someone', state: {} },
  ])('should return the value calling with %s', (message) => {
    expect(makeMessage(message)).toEqual(message);
  });
});

describe('makeMessageWithoutSender', () => {
  it.each([
    '', null, {},
    { type: '' },
  ])('should throw TypeError when calling with %s', (message) => {
    expect(() => makeMessageWithoutSender(message)).toThrow(TypeError);
  });

  it.each([
    { type: MessageTypes.Leave },
    { type: MessageTypes.Handover },
    { type: MessageTypes.Handover, state: {} },
  ])('should return the value calling with %s', (message) => {
    expect(makeMessageWithoutSender(message)).toEqual(message);
  });
});
