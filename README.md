[![Build Status](https://travis-ci.org/LuckboxGG/ipc-messenger.svg?branch=master)](https://travis-ci.org/LuckboxGG/ipc-messenger)

[![Coverage Status](https://coveralls.io/repos/github/LuckboxGG/ipc-messenger/badge.svg?branch=master)](https://coveralls.io/github/LuckboxGG/ipc-messenger?branch=master)

### Usage

```
const ipcMessenger = new RedisIPCMessenger({
  instance: 'test',
  redisOpts: {
    host: 'redis',
    port: 6379,
    expireTime: 10000,
    refreshInterval: 1000,
  }.
});

```

### Methods

- `join(room: Room, callback: Function)` - Joins the room provided in the constructor args and automatically starts listening for new messages
- `getOtherInstances(room: Room)` - Retrieves an array of the other participants in the room
- `send(room: Room, message: Message)` - Sends a message to the rest of the participants in the room

