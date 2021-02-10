[![Build Status](https://travis-ci.org/LuckboxGG/ipc-messenger.svg?branch=master)](https://travis-ci.org/LuckboxGG/ipc-messenger)

[![Coverage Status](https://coveralls.io/repos/github/LuckboxGG/ipc-messenger/badge.svg?branch=master)](https://coveralls.io/github/LuckboxGG/ipc-messenger?branch=master)

### Usage

```
const ipcMessenger = new RedisIPCMessenger({
  callback: () => {},
  instance: 'test',
  room: 'some-room',
  expireTime: 10000,
  refreshTime: 1000,
});

```

### Methods

- `join()` - Joins the room provided in the constructor args and automatically starts listening for new messages
- `getOtherInstances()` - Retrieves an array of the other participants in the room
- `send(message: Message)` - Sends a message to the rest of the participants in the room

