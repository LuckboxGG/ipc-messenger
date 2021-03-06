import Redis from 'ioredis';
import omit from 'lodash.omit';

import IPCMessenger, {
  Room,
  Instance,
  MessageCallback,
  MessageTypes,
  Message,
  makeRoom,
  makeMessage,
  MessageWithoutSender,
  makeInstance,
} from './IPCMessenger';

type ConstructorParams = {
  instance: Instance;
  redisOpts?: Redis.RedisOptions & {
    expireTime?: number,
    refreshInterval?: number,
  }
}

export default class RedisIPCMessenger implements IPCMessenger {
  private readonly instance: Instance;
  private readonly publisher: Redis.Redis;
  private readonly subscriber: Redis.Redis;
  private readonly expireTime: number;
  private readonly refreshInterval: number;
  private subscriptions: Map<Room, MessageCallback>;
  private hasSetupCallbacks: boolean;

  constructor(params: ConstructorParams) {
    this.instance = params.instance;
    this.subscriptions = new Map();
    const ioRedisConfig = omit(params.redisOpts ?? {}, [
      'expireTime',
      'refreshInterval',
    ]);
    this.publisher = new Redis(ioRedisConfig);
    this.subscriber = new Redis(ioRedisConfig);
    this.expireTime = params.redisOpts?.expireTime ?? 30000;
    this.refreshInterval = params.redisOpts?.refreshInterval ?? 10000;
    this.hasSetupCallbacks = false;
  }

  async join(room: Room, callback: MessageCallback): Promise<void> {
    this.storeSubscription(room, callback);
    await this.setupCallbacksIfNecessary();
    await this.subscribeForRoomEvents(room);
    await this.startRefreshKeyLoop(room);
  }

  async getOtherInstances(room: Room): Promise<Array<Instance>> {
    this.makeSureRoomIsJoined(room);

    const keys = await this.publisher.keys(`${room}:*`);
    const otherInstances: Array<Instance> = [];
    for (const key of keys) {
      try {
        const parts = key.split(':');
        const instance = makeInstance(parts[1]);
        if (instance !== this.instance) {
          otherInstances.push(instance);
        }
      } catch (err) {
        this.warn(err);
      }
    }

    return otherInstances;
  }

  async send(room: Room, message: MessageWithoutSender): Promise<void> {
    this.makeSureRoomIsJoined(room);

    await this.publisher.publish(room, this.serialize({
      ...message,
      sender: this.instance,
    } as Message));
  }

  private startRefreshKeyLoop = async (room: Room) => {
    await this.publisher.set(`${room}:${this.instance}`, '', 'EX', this.expireTime / 1000);
    setTimeout(() => this.startRefreshKeyLoop(room), this.refreshInterval);
  };

  private storeSubscription(room: Room, callback: MessageCallback) {
    this.subscriptions.set(room, callback);
  }

  private async subscribeForRoomEvents(room: Room) {
    await this.subscriber.psubscribe(`__keyspace@0__:${room}:*`);
    await this.subscriber.subscribe(`${room}`);
  }

  private makeSureRoomIsJoined(room: Room) {
    if (!this.subscriptions.has(room)) {
      throw new Error(`You are not joined in ${room}!`);
    }
  }

  private async setupCallbacksIfNecessary() {
    if (this.hasSetupCallbacks) {
      return;
    }

    await this.subscriber.config('SET', 'notify-keyspace-events', 'Kx');
    this.subscriber.on('pmessage', this.onExpiredKeyMessage);
    this.subscriber.on('message', this.onPubSubMessage);

    this.hasSetupCallbacks = true;
  }

  private onExpiredKeyMessage = (_pattern: string, key: string) => {
    try {
      const parts = key.split(':');
      const callback = this.subscriptions.get(makeRoom(parts[1]));
      if (!callback) {
        throw new Error(`Failed to map ${key} to a callback`);
      }

      const message = makeMessage({
        type: MessageTypes.Leave,
        sender: parts[2],
      });

      if (this.isMessageMine(message)) {
        return;
      }

      callback(message);
    } catch (err) {
      this.warn(err);
    }
  }

  private onPubSubMessage = (channel: string, payload: string) => {
    try {
      const callback = this.subscriptions.get(makeRoom(channel));
      if (!callback) {
        throw new Error(`Failed to map ${channel} to a callback`);
      }

      const message = this.deserialize(payload);
      if (this.isMessageMine(message)) {
        return;
      }

      callback(message);
    } catch (err) {
      this.warn(err);
    }
  }

  private serialize(message: Message) {
    return JSON.stringify(message);
  }

  private deserialize(payload: string) {
    return makeMessage(JSON.parse(payload));
  }

  private warn(...args: Array<unknown>) {
    console.warn(`[${new Date().toISOString()}][RedisIPCMessenger]`, ...args);
  }

  private isMessageMine(message: Message) {
    return message.sender === this.instance;
  }
}
