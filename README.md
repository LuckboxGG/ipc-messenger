[![Build Status](https://travis-ci.org/LuckboxGG/ipc-messenger.svg?branch=master)](https://travis-ci.org/LuckboxGG/ipc-messenger)

[![Coverage Status](https://coveralls.io/repos/github/LuckboxGG/ipc-messenger/badge.svg?branch=master)](https://coveralls.io/github/LuckboxGG/ipc-messenger?branch=master)

### Usage

```
const ipcMessenger = new RabbitMQIPCMessenger({
  instance: 'test',
  amqp: {
    connectionOpts: {},
    httpUrl: 'http://localhost:15672'
  }
});

```

### Methods

- `join()` - Joins the room
- `getOtherInstances()` - Retrieves an array of the other participants in the room (room is passed in the constructor)
- `send(message: Message)` - Sends a message to the rest of the participants in the room

