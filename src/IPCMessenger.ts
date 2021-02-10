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
  join(): Promise<void>;
  getOtherInstances(): Promise<Array<Instance>>;
  send(message: Message): Promise<void>;
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
