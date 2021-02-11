import Redis from 'ioredis';
import IPCMessenger, {
  Room,
  Instance,
  MessageCallback,
  MessageTypes,
  Message,
  makeInstance,
  makeRoom,
} from './IPCMessenger';

type ConstructorParams = {
  instance: string;
  redis?: Redis.RedisOptions,
  expireTime?: number,
  refreshInterval?: number,
}

class RedisIPCMessenger implements IPCMessenger {
  private readonly instance: Instance;
  private readonly publisher: Redis.Redis;
  private readonly subscriber: Redis.Redis;
  private readonly expireTime: number;
  private readonly refreshInterval: number;
  private subscriptions: Map<Room, MessageCallback>;
  private hasSetupCallbacks: boolean;

  constructor(params: ConstructorParams) {
    this.instance = makeInstance(params.instance);
    this.subscriptions = new Map();
    this.publisher = new Redis(params.redis);
    this.subscriber = new Redis(params.redis);
    this.expireTime = params.expireTime ?? 30000;
    this.refreshInterval = params.refreshInterval ?? 10000;
    this.hasSetupCallbacks = false;
  }

  async join(roomName: string, callback: MessageCallback): Promise<void> {
    const room = makeRoom(roomName);

    this.storeSubscription(room, callback);
    await this.setupCallbacksIfNecessary();
    await this.subscribeForRoomEvents(room);
    await this.startRefreshKeyLoop(room);
  }

  async getOtherInstances(roomName: string): Promise<Array<Instance>> {
    const room = makeRoom(roomName);
    this.makeSureRoomIsJoined(room);

    const keys = await this.publisher.keys(`${room}:*`);
    return keys.map((key) => {
      const [, instance] = key.split(':');
      return instance as Instance;
    }).filter((instance) => instance !== this.instance);
  }

  async send(roomName: string, message: Omit<Message, 'sender'>): Promise<void> {
    const room = makeRoom(roomName);
    this.makeSureRoomIsJoined(room);

    await this.publisher.publish(room, this.serialize({
      ...message,
      sender: this.instance,
    }));
  }

  private startRefreshKeyLoop = async (room: Room) => {
    await this.publisher.set(`${room}:${this.instance}`, '', 'EX', this.expireTime / 1000);
    setTimeout(this.startRefreshKeyLoop, this.refreshInterval);
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
      const [, room, instance] = key.split(':');
      const callback = this.subscriptions.get(makeRoom(room));
      if (!callback) {
        throw new Error(`Failed to map ${key} to a callback`);
      }

      callback({
        type: MessageTypes.Leave,
        sender: makeInstance(instance),
      });
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
      if (message.sender === this.instance) {
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
    return JSON.parse(payload) as Message;
  }

  private warn(...args: Array<unknown>) {
    console.warn('[RedisIPCMessenger]', ...args);
  }
}

export default RedisIPCMessenger;
