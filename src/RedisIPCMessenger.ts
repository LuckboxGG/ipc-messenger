import Redis from 'ioredis';
import IPCMessenger, {
  Room,
  Instance,
  MessageCallback,
  MessageTypes,
  Message,
} from './IPCMessenger';

type ConstructorParams = {
  room: Room;
  instance: Instance;
  callback: MessageCallback,
  redis?: Redis.RedisOptions,
  expireTime?: number,
  refreshTime?: number,
}

class RedisIPCMessenger implements IPCMessenger {
  private readonly room: Room;
  private readonly instance: Instance;
  private readonly callback: MessageCallback;
  private readonly publisher: Redis.Redis;
  private readonly subscriber: Redis.Redis;
  private readonly expireTime: number;
  private readonly refreshTime: number;
  private hasJoined: boolean;

  constructor(params: ConstructorParams) {
    this.validateInput(params);

    this.room = params.room;
    this.instance = params.instance;
    this.callback = params.callback;

    this.publisher = new Redis(params.redis);
    this.subscriber = new Redis(params.redis);
    this.expireTime = params.expireTime ?? 30000;
    this.refreshTime = params.refreshTime ?? 10000;
    this.hasJoined = false;
  }

  async join(): Promise<void> {
    if (this.hasJoined) {
      throw new Error('Can\'t join twice!');
    }

    const refreshKeyLoop = async () => {
      await this.publisher.set(`${this.room}:${this.instance}`, '', 'EX', this.expireTime / 1000);
      setTimeout(refreshKeyLoop, this.refreshTime);
    };
    await refreshKeyLoop();

    await this.subscriber.config('SET', 'notify-keyspace-events', 'Kx');
    await this.subscriber.psubscribe(`__keyspace@0__:${this.room}:*`);
    this.subscriber.on('pmessage', (pattern, key) => {
      const [, , instance] = key.split(':');
      this.callback({
        type: MessageTypes.Leave,
        sender: instance,
      });
    });

    await this.subscriber.subscribe(`${this.room}`);
    this.subscriber.on('message', (channel, payload) => {
      const message = this.deserialize(payload);
      if (message.sender === this.instance) {
        // Skip our own messages
        return;
      }

      this.callback(message);
    });
    this.hasJoined = true;
  }

  async getOtherInstances(): Promise<Array<Instance>> {
    if (!this.hasJoined) {
      throw new Error('Join first!');
    }

    const keys = await this.publisher.keys(`${this.room}:*`);
    return keys.map((key) => {
      const [, instance] = key.split(':');
      return instance;
    }).filter((instance) => instance !== this.instance);
  }

  async send(message: Omit<Message, 'sender'>): Promise<void> {
    if (!this.hasJoined) {
      throw new Error('Join first!');
    }

    await this.publisher.publish(this.room, this.serialize({
      ...message,
      sender: this.instance,
    }));
  }

  private validateInput(params: ConstructorParams) {
    if (!params.room.length || params.room.includes(':')) {
      throw new TypeError(`room must be a non empty string and should not include ':', ${params.room} received`);
    }

    if (!params.instance.length || params.instance.includes(':')) {
      throw new TypeError(`instance must be a non empty string and should not include ':', ${params.instance} received`);
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
