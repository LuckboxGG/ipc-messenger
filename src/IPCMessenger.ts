import Opaque from 'ts-opaque';
import baseIsPlainObject from 'lodash.isplainobject';

export type Room = Opaque<string, 'Room'>;
const isRoom = (input: unknown): input is Room => (
  typeof input === 'string' &&
  input.length > 0 &&
  !input.includes(':')
);

export const makeRoom = (input: unknown): Room => {
  if (!isRoom(input)) {
    throw new TypeError(`${JSON.stringify(input)} is not a valid Room`);
  }

  return input;
};

export type Instance = Opaque<string, 'Instance'>;
const isInstance = (input: unknown): input is Instance => (
  typeof input === 'string' &&
  input.length > 0 &&
  !input.includes(':')
);

export const makeInstance = (input: unknown): Instance => {
  if (!isInstance(input)) {
    throw new TypeError(`${JSON.stringify(input)} is not a valid Instance`);
  }

  return input;
};

type PlainObject = Record<string, unknown>;
const isPlainObject = (value: unknown): value is PlainObject => baseIsPlainObject(value);

type MessageType = Opaque<string, 'NonEmptyString'>;
const isMessageType = (value: unknown): value is MessageType => typeof value === 'string' && value.length > 0;
export const makeMessageType = (value: unknown): MessageType => {
  if (!isMessageType(value)) {
    throw new TypeError(`Value '${JSON.stringify(value)}' could not be interpreted as non-empty string!`);
  }

  return value;
};

type MessageData = string | number | boolean | null | MessageDataArray | MessageDataObject;
type MessageDataArray = Array<MessageData>;
interface MessageDataObject {
  [key: string]: MessageData;
}

export type Message = Opaque<{
  type: MessageType,
  sender: Instance,
  data?: MessageData,
}, 'Message'>;

export type MessageWithoutSender = Omit<Message, 'sender'>;
export type MessageCallback = (message: Message) => void;

export enum MessageTypes {
  Handover = 'handover',
  Leave = 'leave'
}

interface IPCMessenger {
  getOtherInstances(): Promise<Array<Instance>>;
  send(message: MessageWithoutSender): Promise<void>;
}

export default IPCMessenger;

const isMessageDataObject = (input: unknown): input is MessageDataObject => {
  if (!isPlainObject(input)) {
    return false;
  }

  for (const key in input) {
    if (!isMessageData(input[key])) {
      return false;
    }
  }

  return true;
};

const isMessageData = (input: unknown): input is MessageData => (
  typeof input === 'string' ||
  typeof input === 'number' ||
  typeof input === 'boolean' ||
  input === null ||
  (Array.isArray(input) && input.every((value) => isMessageData(value))) ||
  isMessageDataObject(input)
);

const isMessageWithoutSender = (input: unknown): input is MessageWithoutSender => (
  isPlainObject(input) &&
  isMessageType(input.type) &&
  typeof input.sender === 'undefined' &&
  (typeof input.data === 'undefined' || isMessageData(input.data))
);

export const makeMessageWithoutSender = (input: unknown): MessageWithoutSender => {
  if (!isMessageWithoutSender(input)) {
    throw new TypeError(`${JSON.stringify(input)} is not a valid MessageWithoutSender`);
  }

  return input;
};

const isMessage = (input: unknown): input is Message => (
  isPlainObject(input) &&
  isMessageType(input.type) &&
  isInstance(input.sender) &&
  (typeof input.data === 'undefined' || isMessageData(input.data))
);

export const makeMessage = (input: unknown): Message => {
  if (!isMessage(input)) {
    throw new TypeError(`${JSON.stringify(input)} is not a valid Message`);
  }

  return input;
};
