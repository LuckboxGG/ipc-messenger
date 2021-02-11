/* eslint-disable @typescript-eslint/no-empty-function, no-new */

import Redis from 'ioredis';
import { MessageTypes } from '../IPCMessenger';
import RedisIPCMessenger from '../RedisIPCMessenger';

jest.mock('ioredis');

const mockedRedis = Redis as jest.Mocked<typeof Redis>;

describe('RedisIPCMessenger', () => {
  const testMessage = {
    type: MessageTypes.Handover,
    sender: 'not-me',
  };

  describe('join', () => {
    const ipcMessenger = new RedisIPCMessenger({
      instance: 'c1',
    });

    it.each([
      '', 'room:',
    ])('should throw TypeError when calling with room - %s', async (room) => {
      await expect(ipcMessenger.join(room, () => {})).rejects.toThrow(TypeError);
    });

    it('should route the message to the correct callback', async () => {
      type GenericFunction = (...arg: Array<any>) => void;
      let hijackedCallback: GenericFunction = () => {};
      mockedRedis.prototype.on = (event: string, callback: GenericFunction) => {
        if (event === 'message') {
          hijackedCallback = callback;
        }
      };

      const spiedCallback1 = jest.fn();
      const spiedCallback2 = jest.fn();
      await ipcMessenger.join('r1', spiedCallback1);
      await ipcMessenger.join('r2', spiedCallback2);

      hijackedCallback('r1', JSON.stringify(testMessage));

      expect(spiedCallback1).toHaveBeenCalledWith(testMessage);
      expect(spiedCallback2).not.toHaveBeenCalled();
    });
  });

  describe('getOtherInstance', () => {
    const ipcMessenger = new RedisIPCMessenger({
      instance: 'c1',
    });

    it.each([
      '', 'room:',
    ])('should throw TypeError when calling with room - %s', async (room) => {
      await expect(ipcMessenger.getOtherInstances(room)).rejects.toThrow(TypeError);
    });

    it('should throw Error when calling without joining the room', async () => {
      await expect(ipcMessenger.getOtherInstances('r1')).rejects.toThrow(Error);
    });

    it('should query all the keys and filter out its own one', async () => {
      await ipcMessenger.join('r1', () => {});

      mockedRedis.prototype.keys.mockImplementationOnce(async (pattern: string) => {
        if (pattern === 'r1:*') {
          return ['r1:c1', 'r1:c2'];
        }
      });

      const otherInstances = await ipcMessenger.getOtherInstances('r1');
      expect(otherInstances).toEqual(['c2']);
    });
  });

  describe('send', () => {
    const ipcMessenger = new RedisIPCMessenger({
      instance: 'c1',
    });

    it.each([
      '', 'room:',
    ])('should throw TypeError when calling with room - %s', async (room) => {
      await expect(ipcMessenger.send(room, testMessage)).rejects.toThrow(TypeError);
    });

    it('should throw Error when calling without joining the room', async () => {
      await expect(ipcMessenger.send('r1', testMessage)).rejects.toThrow(Error);
    });

    it('should publish the payload in the correct namespace', async () => {
      await ipcMessenger.join('r1', () => {});
      await ipcMessenger.join('r2', () => {});
      await ipcMessenger.send('r1', testMessage);

      expect(mockedRedis.prototype.publish).toHaveBeenCalledWith('r1', JSON.stringify({
        ...testMessage,
        sender: 'c1',
      }));
    });
  });
});
