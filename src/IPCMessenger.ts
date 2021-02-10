type Room = string;
type Instance = string;

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

export default IPCMessenger;
export {
  Room,
  Instance,
  MessageTypes,
  HandoverMessage,
  LeaveMessage,
  Message,
  MessageCallback,
};
