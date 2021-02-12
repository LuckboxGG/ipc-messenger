import Opaque from 'ts-opaque';
import isPlainObject from 'lodash.isplainobject';

type Room = Opaque<string, 'Room'>;
type Instance = Opaque<string, 'Instance'>;

enum MessageTypes {
  Handover = 'handover',
  Leave = 'leave'
}

type HandoverMessage = {
  type: MessageTypes.Handover,
  sender: Instance,
  state?: Record<string, unknown>,
};

type LeaveMessage = {
  type: MessageTypes.Leave,
  sender: Instance,
};

type Message = HandoverMessage | LeaveMessage;
type MessageWithoutSender = Omit<Message, 'sender'>;
type MessageCallback = (message: Message) => void;

interface IPCMessenger {
  join(room: Room, callback: MessageCallback): Promise<void>;
  getOtherInstances(room: Room): Promise<Array<Instance>>;
  send(room: Room, message: MessageWithoutSender): Promise<void>;
}

const isRoom = (input: unknown): input is Room => (
  typeof input === 'string' &&
  input.length > 0 &&
  !input.includes(':')
);

const makeRoom = (input: unknown): Room => {
  if (!isRoom(input)) {
    throw new TypeError(`${JSON.stringify(input)} is not a valid Room`);
  }

  return input;
};

const isInstance = (input: unknown): input is Instance => (
  typeof input === 'string' &&
  input.length > 0 &&
  !input.includes(':')
);

const makeInstance = (input: unknown): Instance => {
  if (!isInstance(input)) {
    throw new TypeError(`${JSON.stringify(input)} is not a valid Instance`);
  }

  return input;
};

const isHandoverMessage = (input: unknown): input is HandoverMessage => (
  isPlainObject(input) &&
  (input as Message).type === MessageTypes.Handover &&
  isInstance((input as Message).sender) &&
  (
    (input as HandoverMessage).state === undefined ||
    isPlainObject((input as HandoverMessage).state)
  )
);

const isLeaveMessage = (input: unknown): input is LeaveMessage => (
  isPlainObject(input) &&
  (input as Message).type === MessageTypes.Leave &&
  isInstance((input as Message).sender)
);

const makeMessage = (input: unknown): Message => {
  if (
    !isHandoverMessage(input) &&
    !isLeaveMessage(input)
  ) {
    throw new TypeError(`${JSON.stringify(input)} is not a valid Message`);
  }

  return input;
};

export default IPCMessenger;
export {
  Room,
  Instance,
  MessageTypes,
  MessageWithoutSender,
  HandoverMessage,
  LeaveMessage,
  Message,
  MessageCallback,
  makeRoom,
  makeInstance,
  makeMessage,
};
