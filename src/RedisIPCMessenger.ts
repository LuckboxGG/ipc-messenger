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
    this.validateInstance(params.instance);

    this.instance = params.instance;
    this.subscriptions = new Map();
    this.publisher = new Redis(params.redis);
    this.subscriber = new Redis(params.redis);
    this.expireTime = params.expireTime ?? 30000;
    this.refreshTime = params.refreshTime ?? 10000;
    this.hasSetupCallbacks = false;
  }

  async join(room: Room, callback: MessageCallback): Promise<void> {
    this.validateRoom(room);

    this.storeSubscription(room, callback);
    await this.setupCallbacksIfNecessary();
    await this.subscribeForRoomEvents(room);
    await this.startRefreshKeyLoop(room);
  }

  async getOtherInstances(room: Room): Promise<Array<Instance>> {
    this.validateRoom(room);
    this.makeSureRoomIsJoined(room);

    const keys = await this.publisher.keys(`${room}:*`);
    return keys.map((key) => {
      const [, instance] = key.split(':');
      return instance;
    }).filter((instance) => instance !== this.instance);
  }

  async send(room: Room, message: Omit<Message, 'sender'>): Promise<void> {
    this.validateRoom(room);
    this.makeSureRoomIsJoined(room);

    await this.publisher.publish(room, this.serialize({
      ...message,
      sender: this.instance,
    }));
  }

  private validateRoom(room: string) {
    if (!room.length || room.includes(':')) {
      throw new TypeError(`room must be a non empty string and should not include ':', ${room} received`);
    }
  }

  private validateInstance(instance: string) {
    if (!instance.length || instance.includes(':')) {
      throw new TypeError(`room/instance must be a non empty string and should not include ':', ${instance} received`);
    }
  }

  private startRefreshKeyLoop = async (room: Room) => {
    const refreshKeyLoop = async () => {
      await this.publisher.set(`${room}:${this.instance}`, '', 'EX', this.expireTime / 1000);
      setTimeout(refreshKeyLoop, this.refreshTime);
    };

    await refreshKeyLoop();
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

  private onExpiredKeyMessage = (pattern: string, key: string) => {
    const [, room, instance] = key.split(':');
    const callback = this.subscriptions.get(room);
    if (callback) {
      callback({
        type: MessageTypes.Leave,
        sender: instance,
      });
    }
  }

  private onPubSubMessage = (channel: string, payload: string) => {
    const callback = this.subscriptions.get(channel);
    if (callback) {
      const message = this.deserialize(payload);
      if (message.sender === this.instance) {
        return;
      }

      callback(message);
    }
  }

  private serialize(message: Message) {
    return JSON.stringify(message);
  }

  private deserialize(payload: string) {
    return JSON.parse(payload) as Message;
  }
}

export default RedisIPCMessenger;
