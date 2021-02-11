import Opaque from 'ts-opaque';

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

type MessageCallback = (message: Message) => void;

interface IPCMessenger {
  join(room: Room, callback: MessageCallback): Promise<void>;
  getOtherInstances(room: Room): Promise<Array<Instance>>;
  send(room: Room, message: Message): Promise<void>;
}

const makeRoom = (room: string): Room => {
  if (!room.length) {
    throw new TypeError('Empty string cannot be used as room!');
  }

  if (room.includes(':')) {
    throw new TypeError('Room must not include \':\'!');
  }

  return room as Room;
};

const makeInstance = (instance: string): Instance => {
  if (!instance.length) {
    throw new TypeError('Empty string cannot be used as instance!');
  }

  if (instance.includes(':')) {
    throw new TypeError('instance must not include \':\'!');
  }

  return instance as Instance;
};

export default IPCMessenger;
export {
  Room,
  Instance,
  MessageTypes,
  HandoverMessage,
  LeaveMessage,
  Message,
  MessageCallback,
  makeRoom,
  makeInstance,
};
