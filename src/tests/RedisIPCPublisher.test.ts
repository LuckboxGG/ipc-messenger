/* eslint-disable @typescript-eslint/no-empty-function, no-new */

import Redis from 'ioredis';
import IPCMessenger, {
  makeInstance,
  makeRoom,
  makeMessage,
} from '../IPCMessenger';
import RedisIPCMessenger from '../RedisIPCMessenger';

jest.mock('ioredis');

const mockedRedis = Redis as jest.Mocked<typeof Redis>;

describe('RedisIPCMessenger', () => {
  const testMessage = makeMessage({
    type: 'handover',
    sender: 'not-me',
  });

  describe('join', () => {
    let ipcMessenger: IPCMessenger;
    beforeEach(() => {
      ipcMessenger = new RedisIPCMessenger({
        instance: makeInstance('c1'),
      });

      mockedRedis.prototype.set.mockReset();
      mockedRedis.prototype.get.mockReset();
    });

    it('should route the message to the correct callback', async () => {
      type GenericFunction = (...arg: Array<any>) => void;
      let hijackedCallback: GenericFunction = () => { };
      mockedRedis.prototype.on = (event: string, callback: GenericFunction) => {
        if (event === 'message') {
          hijackedCallback = callback;
        }
      };

      const spiedCallback1 = jest.fn();
      const spiedCallback2 = jest.fn();
      await ipcMessenger.join(makeRoom('r1'), spiedCallback1);
      await ipcMessenger.join(makeRoom('r2'), spiedCallback2);

      hijackedCallback('r1', JSON.stringify(testMessage));

      expect(spiedCallback1).toHaveBeenCalledWith(testMessage);
      expect(spiedCallback2).not.toHaveBeenCalled();
    });

    it('should skip the event for its own expired key message', async () => {
      type GenericFunction = (...arg: Array<any>) => void;
      let hijackedCallback: GenericFunction = () => { };
      mockedRedis.prototype.on = (event: string, callback: GenericFunction) => {
        if (event === 'pmessage') {
          hijackedCallback = callback;
        }
      };

      const spiedCallback = jest.fn();
      await ipcMessenger.join(makeRoom('r1'), spiedCallback);

      hijackedCallback('', '_:r1:c1');
      expect(spiedCallback).not.toHaveBeenCalled();

      hijackedCallback('', '_:r1:c2');
      expect(spiedCallback).toHaveBeenCalledWith({
        type: 'leave',
        sender: 'c2',
      });
    });

    it('should refresh its key periodically', async () => {
      const customIpcMessenger = new RedisIPCMessenger({
        instance: makeInstance('c1'),
        redisOpts: {
          refreshInterval: 100,
          expireTime: 2000,
        },
      });

      await customIpcMessenger.join(makeRoom('r1'), () => {});
      await sleep(150);

      expect(mockedRedis.prototype.set).toHaveBeenCalledTimes(2);
      expect(mockedRedis.prototype.set).toHaveBeenNthCalledWith(1, 'r1:c1', '', 'EX', 2);
      expect(mockedRedis.prototype.set).toHaveBeenNthCalledWith(2, 'r1:c1', '', 'EX', 2);
    });
  });

  describe('getOtherInstance', () => {
    const ipcMessenger = new RedisIPCMessenger({
      instance: makeInstance('c1'),
    });

    it('should throw Error when calling without joining the room', async () => {
      await expect(ipcMessenger.getOtherInstances(makeRoom('r1'))).rejects.toThrow(Error);
    });

    it('should query all the keys and filter out its own one', async () => {
      await ipcMessenger.join(makeRoom('r1'), () => { });

      mockedRedis.prototype.keys.mockImplementationOnce(async (pattern: string) => {
        if (pattern === 'r1:*') {
          return ['r1:c1', 'r1:c2'];
        }
      });

      const otherInstances = await ipcMessenger.getOtherInstances(makeRoom('r1'));
      expect(otherInstances).toEqual(['c2']);
    });
  });

  describe('send', () => {
    const ipcMessenger = new RedisIPCMessenger({
      instance: makeInstance('c1'),
    });

    it('should throw Error when calling without joining the room', async () => {
      await expect(ipcMessenger.send(makeRoom('r1'), testMessage)).rejects.toThrow(Error);
    });

    it('should publish the payload in the correct namespace', async () => {
      await ipcMessenger.join(makeRoom('r1'), () => { });
      await ipcMessenger.join(makeRoom('r2'), () => { });
      await ipcMessenger.send(makeRoom('r1'), testMessage);

      expect(mockedRedis.prototype.publish).toHaveBeenCalledWith('r1', JSON.stringify({
        ...testMessage,
        sender: 'c1',
      }));
    });
  });
});

function sleep(msec: number) {
  return new Promise((resolve) => setTimeout(resolve, msec));
}
