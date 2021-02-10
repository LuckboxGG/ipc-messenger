/* eslint-disable @typescript-eslint/no-empty-function, no-new */

import Redis from 'ioredis';
import { MessageTypes } from '../IPCMessenger';
import RedisIPCMessenger from '../RedisIPCMessenger';

jest.mock('ioredis');

const mockedRedis = Redis as jest.Mocked<typeof Redis>;

describe('RedisIPCMessenger', () => {
  it('should fail to construct with empty room', () => {
    expect(() => {
      new RedisIPCMessenger({
        callback: () => {},
        instance: 'test',
        room: '',
      });
    }).toThrow(TypeError);
  });

  it('should fail to construct with room containing ":"', () => {
    expect(() => {
      new RedisIPCMessenger({
        callback: () => {},
        instance: 'test',
        room: 'a:b',
      });
    }).toThrow(TypeError);
  });

  it('should fail to construct with empty instance', () => {
    expect(() => {
      new RedisIPCMessenger({
        callback: () => {},
        instance: '',
        room: 'test',
      });
    }).toThrow(TypeError);
  });

  it('should fail to construct with instance containing ":"', () => {
    expect(() => {
      new RedisIPCMessenger({
        callback: () => {},
        instance: 'test',
        room: 'a:b',
      });
    }).toThrow(TypeError);
  });

  it('should query all the keys when calling getOtherInstances', async () => {
    const redisIpcMessenger = new RedisIPCMessenger({
      callback: () => {},
      instance: 'c1',
      room: 'ab',
    });

    await redisIpcMessenger.join();

    mockedRedis.prototype.keys.mockImplementationOnce(async (pattern: string) => {
      if (pattern === 'ab:*') {
        return ['ab:c1', 'ab:c2'];
      }
    });

    const otherInstances = await redisIpcMessenger.getOtherInstances();
    expect(otherInstances).toEqual(['c2']);
  });

  it('should publish the message', async () => {
    const redisIpcMessenger = new RedisIPCMessenger({
      callback: () => {},
      instance: 'c1',
      room: 'ab',
    });

    await redisIpcMessenger.join();
    await redisIpcMessenger.send({
      type: MessageTypes.Handover,
    });

    expect(mockedRedis.prototype.publish).toHaveBeenCalledWith('ab', JSON.stringify({
      type: MessageTypes.Handover,
      sender: 'c1',
    }));
  });
});
