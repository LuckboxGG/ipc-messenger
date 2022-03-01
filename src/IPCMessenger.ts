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

type MessageDataTypes = string | number | boolean | null | MessageDataArray | MessageDataObject;
type MessageDataArray = Array<MessageDataTypes>;
interface MessageDataObject {
  [key: string]: MessageDataTypes;
}

export type Message = {
  type: MessageType,
  sender: Instance,
  data?: MessageDataTypes,
};

export type MessageWithoutSender = Omit<Message, 'sender'>;
export type MessageCallback = (message: Message) => void;

export enum MessageTypes {
  Handover = 'handover',
  Leave = 'leave'
}

export type HandoverMessage = Opaque<{
  type: MessageTypes.Handover,
  sender: Instance,
  state?: Record<string, unknown>,
}, 'HandoverMessage'>

export type LeaveMessage = Opaque<{
  type: MessageTypes.Leave,
  sender: Instance,
}, 'LeaveMessage'>;

interface IPCMessenger {
  join(room: Room, callback: MessageCallback): Promise<void>;
  leave(room: Room): Promise<void>;
  getOtherInstances(room: Room): Promise<Array<Instance>>;
  send(room: Room, message: MessageWithoutSender): Promise<void>;
}

export default IPCMessenger;

const isMessageWithoutSender = (input: unknown): input is MessageWithoutSender => (
  isPlainObject(input) &&
  isMessageType(input.type) &&
  typeof input.sender === 'undefined'
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
  isInstance(input.sender)
);

export const makeMessage = (input: unknown): Message => {
  if (!isMessage(input)) {
    throw new TypeError(`${JSON.stringify(input)} is not a valid Message`);
  }

  return input;
};
