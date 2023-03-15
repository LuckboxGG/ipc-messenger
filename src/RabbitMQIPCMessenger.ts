import IPCMessenger, {
  Room,
  Instance,
  MessageCallback,
  MessageWithoutSender,
  makeInstance,
  makeMessage,
  MessageTypes,
} from './IPCMessenger';
import amqplib from 'amqplib';
import HttpAdapterFactory, { HttpAdapter } from '@luckbox/http-adapter-factory';
import { Logger, LoggerFactory } from '@luckbox/logger-factory';
import assert from 'assert';
import PQueue from 'p-queue';
import { promisify } from 'util';

type ConnectionOpts = {
  protocol?: string | undefined;
  hostname?: string | undefined;
  port?: number | undefined;
  username?: string | undefined;
  password?: string | undefined;
  vhost?: string | undefined;
}

type ConstructorParams = {
  instance: Instance;
  amqp: {
    connectionOpts: ConnectionOpts,
    httpUrl: string,
  },
  loggerFactory: LoggerFactory,
  room: Room,
}

export default class RabbitMQIPCMessenger implements IPCMessenger {
  private httpAdapter: HttpAdapter;
  private connection: amqplib.Connection | null = null;
  private channel: amqplib.ConfirmChannel | null = null;
  private logger: Logger;
  private isConnected = false;
  private isConnecting = false;
  private queue = new PQueue({ concurrency: 1 });
  private retryDelay = 5000;
  private detectLeftInstancesInterval = 1000;
  private callback: MessageCallback | null = null;

  constructor(private params: ConstructorParams) {
    const httpAdapterFactory = new HttpAdapterFactory();
    this.httpAdapter = httpAdapterFactory.create({});
    this.logger = params.loggerFactory.create(this.constructor.name);
  }

  async join(callback: MessageCallback): Promise<void> {
    this.callback = callback;

    this.isConnecting = true;
    await this.setupConnection();
    this.isConnected = true;
    this.isConnecting = false;

    await this.detectLeftInstances();
  }

  async getOtherInstances(): Promise<Array<Instance>> {
    const queues = await this.getQueuesBoundToExchange(this.params.room);
    return queues
      .filter((queue) => queue !== this.params.instance)
      .map((queue) => makeInstance(queue));
  }

  async send(message: MessageWithoutSender): Promise<void> {
    assert(this.connection);
    assert(this.channel);

    const tryToSendMessageLoop = async (): Promise<void> => {
      const publishAsync = promisify((this.channel as amqplib.ConfirmChannel).publish);

      try {
        await publishAsync(this.params.room, '', this.toBuffer({ ...message, sender: this.params.instance }), {});
        return;
      } catch (err) {
        this.logger.error(err);
        await this.sleep(this.retryDelay);
      }

      return tryToSendMessageLoop();
    };

    await this.queue.add(tryToSendMessageLoop);
  }

  private async detectLeftInstances() {
    let lastKnownOtherInstances = await this.getQueuesBoundToExchangeOrFailGracefully(this.params.room);
    setInterval(async () => {
      const otherInstances = await this.getQueuesBoundToExchangeOrFailGracefully(this.params.room);
      if (!otherInstances) {
        return;
      }

      if (!lastKnownOtherInstances) {
        lastKnownOtherInstances = otherInstances;
        return;
      }

      const leftInstances = lastKnownOtherInstances.filter((lastKnownInstance) => !otherInstances.includes(lastKnownInstance));
      leftInstances.forEach((leftInstance) => (this.callback as MessageCallback)(makeMessage({ type: MessageTypes.Leave, sender: leftInstance })));
      lastKnownOtherInstances = otherInstances;
    }, this.detectLeftInstancesInterval);
  }

  private async setupConnection() {
    this.connection = await amqplib.connect(this.params.amqp.connectionOpts);
    this.channel = await this.connection.createConfirmChannel();

    this.connection.off('error', this.handleConnectionOrChannelProblem);
    this.connection.on('error', this.handleConnectionOrChannelProblem);
    this.connection.off('close', this.handleConnectionOrChannelProblem);
    this.connection.on('close', this.handleConnectionOrChannelProblem);

    this.channel.off('error', this.handleConnectionOrChannelProblem);
    this.channel.on('error', this.handleConnectionOrChannelProblem);
    this.channel.off('close', this.handleConnectionOrChannelProblem);
    this.channel.on('close', this.handleConnectionOrChannelProblem);

    await this.channel.assertExchange(this.params.room, 'fanout', { durable: true });
    const queue = await this.channel.assertQueue(this.params.instance, {
      exclusive: true,
      durable: false,
    });
    await this.channel.bindQueue(queue.queue, this.params.room, '');
    await this.channel.consume(queue.queue, async (payload) => {
      if (!payload) {
        return;
      }

      let message;
      try {
        message = makeMessage(this.parseBuffer(payload.content));
      } catch (err) {
        this.logger.error(err);
        return;
      }

      if (message.sender === this.params.instance) {
        return;
      }

      (this.callback as MessageCallback)(message);
    });
  }

  private handleConnectionOrChannelProblem = async (err?: Error) => {
    if (err) {
      this.logger.error(err);
    }

    this.isConnected = false;

    if (this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    while (!this.isConnected) {
      try {
        await this.setupConnection();
        this.isConnected = true;
      } catch (connectionErr) {
        this.logger.error('Connection error:', connectionErr);
        await this.sleep(this.retryDelay);
      }
    }
    this.isConnecting = false;
  };

  private async getQueuesBoundToExchange(exchange: string) {
    const { username, password, vhost } = this.params.amqp.connectionOpts;
    const vhostPart = encodeURIComponent(vhost ?? '/');
    const response = await this.httpAdapter.get(`${this.params.amqp.httpUrl}/api/exchanges/${vhostPart}/${exchange}/bindings/source`, {}, {
      'Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64'),
    }) as Array<{ destination: string }>;

    return response.map((queue) => queue.destination);
  }

  private async getQueuesBoundToExchangeOrFailGracefully(exchange: string) {
    try {
      return await this.getQueuesBoundToExchange(exchange);
    } catch (err) {
      this.logger.warn('Error during getting queues bound to exchange:', err);
      return null;
    }
  }

  private toBuffer(data: unknown) {
    return Buffer.from(JSON.stringify(data));
  }

  private parseBuffer(buffer: Buffer) {
    return JSON.parse(buffer.toString());
  }

  private sleep(msec: number) {
    return new Promise((resolve) => setTimeout(resolve, msec));
  }
}
