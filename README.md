[![Build Status](https://travis-ci.org/LuckboxGG/ipc-messenger.svg?branch=master)](https://travis-ci.org/LuckboxGG/ipc-messenger)

[![Coverage Status](https://coveralls.io/repos/github/LuckboxGG/ipc-messenger/badge.svg?branch=master)](https://coveralls.io/github/LuckboxGG/ipc-messenger?branch=master)

### Usage

```
const ipcMessenger = new RedisIPCMessenger({
  instance: 'test',
  expireTime: 10000,
  refreshInterval: 1000,
});

```

### Methods

- `join(room: string, callback: Function)` - Joins the room provided in the constructor args and automatically starts listening for new messages
- `getOtherInstances(room: string)` - Retrieves an array of the other participants in the room
- `send(room: string, message: Message)` - Sends a message to the rest of the participants in the room

