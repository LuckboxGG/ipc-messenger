import Redis from 'ioredis';
import IPCMessenger, {
  Room,
  Instance,
  MessageCallback,
  MessageTypes,
  Message,
} from './IPCMessenger';

type ConstructorParams = {
  instance: Instance;
  redis?: Redis.RedisOptions,
  expireTime?: number,
  refreshTime?: number,
}

class RedisIPCMessenger implements IPCMessenger {
  private readonly instance: Instance;
  private readonly publisher: Redis.Redis;
  private readonly subscriber: Redis.Redis;
  private readonly expireTime: number;
  private readonly refreshTime: number;
  private subscriptions: Map<Room, MessageCallback>;
  private hasSetupCallbacks: boolean;

  constructor(params: ConstructorParams) {
    this.validateRoomOrInstance(params.instance);

    this.instance = params.instance;
    this.subscriptions = new Map();
    this.publisher = new Redis(params.redis);
    this.subscriber = new Redis(params.redis);
    this.expireTime = params.expireTime ?? 30000;
    this.refreshTime = params.refreshTime ?? 10000;
    this.hasSetupCallbacks = false;
  }

  async join(room: Room, callback: MessageCallback): Promise<void> {
    this.validateRoomOrInstance(room);

    this.subscriptions.set(room, callback);

    const refreshKeyLoop = async () => {
      await this.publisher.set(`${room}:${this.instance}`, '', 'EX', this.expireTime / 1000);
      setTimeout(refreshKeyLoop, this.refreshTime);
    };
    await refreshKeyLoop();

    await this.subscriber.config('SET', 'notify-keyspace-events', 'Kx');
    await this.subscriber.psubscribe(`__keyspace@0__:${room}:*`);
    await this.subscriber.subscribe(`${room}`);

    this.setupCallbacksIfNecessary();
  }

  async getOtherInstances(room: Room): Promise<Array<Instance>> {
    this.validateRoomOrInstance(room);

    if (!this.subscriptions.has(room)) {
      throw new Error(`You are not joined in ${room}!`);
    }

    const keys = await this.publisher.keys(`${room}:*`);
    return keys.map((key) => {
      const [, instance] = key.split(':');
      return instance;
    }).filter((instance) => instance !== this.instance);
  }

  async send(room: Room, message: Omit<Message, 'sender'>): Promise<void> {
    this.validateRoomOrInstance(room);

    if (!this.subscriptions.has(room)) {
      throw new Error(`You are not joined in ${room}!`);
    }

    await this.publisher.publish(room, this.serialize({
      ...message,
      sender: this.instance,
    }));
  }

  private validateRoomOrInstance(roomOrInstance: string) {
    if (!roomOrInstance.length || roomOrInstance.includes(':')) {
      throw new TypeError(`room/instance must be a non empty string and should not include ':', ${roomOrInstance} received`);
    }
  }

  private setupCallbacksIfNecessary() {
    if (this.hasSetupCallbacks) {
      return;
    }

    this.subscriber.on('pmessage', (pattern, key) => {
      const [, room, instance] = key.split(':');
      const callback = this.subscriptions.get(room);
      if (callback) {
        callback({
          type: MessageTypes.Leave,
          sender: instance,
        });
      }
    });

    this.subscriber.on('message', (room, payload) => {
      const callback = this.subscriptions.get(room);
      if (callback) {
        const message = this.deserialize(payload);
        if (message.sender === this.instance) {
          // Skip our own messages
          return;
        }

        callback(message);
      }
    });

    this.hasSetupCallbacks = true;
  }

  private serialize(message: Message) {
    return JSON.stringify(message);
  }

  private deserialize(payload: string) {
    return JSON.parse(payload) as Message;
  }
}

export default RedisIPCMessenger;
