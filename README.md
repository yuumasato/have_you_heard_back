# Have you heard - back-end

A game about misunderstanding.

## Dependencies

This is a node.js module using socket.io, redis, cluster, and express.
A postgres database is used.

With git and npm installed, you can run:

```
$ git clone https://github.com/toshisasaki/have_you_heard_back.git
$ cd have_you_heard_back
$ npm install
```

Check the package.json content for details.

## Database setup

To store the game data a postgres database is used.
The module expects the database connection url to be set on the DATABASE_URL env
variable.  See the ``scripts/init_env.sh`` for details.

A database called ``have_you_heard`` is expected to be accessible containing a
table for each supported language, named ``<language>_headlines`` (e.g.
``pt_headlines`` for portuguese).

The tables should be populated with 3 columns

```
| id | link | headline |
```

The headline should be a string where the part to be replaced is marked between
``[]`` (e.g. ``This is a [valid] string.``).

## How to run

To test and run, you need a redis instance running. For development and debug,
it is assumed that the redis instance is running on localhost on default port
6379.

You may set the environment variable ``REDIS_URL`` pointing to a different
address and port.

On Fedora, you can install redis by running:

```
$ sudo dnf install redis
```

Then, to start the service:

```
$ systemctl start redis
```

To run localy, you can run:
```
$ npm start
```
or
```
$ node src
```

To make the console output verbose for debugging, you can set the DEBUG
environment variable:

```
$ DEBUG=have_you_heard node --trace-warnings src
```
or make the debug verbose for all packages:
```
$ DEBUG=* node --trace-warnings src
```

By default, the server is listening on http://localhost:3000. You can set a
different port by setting the environment variable ``PORT``.

With the server running, the socket.io clients can connect and exchange
messages.

# Implementation details

The server starts a cluster which starts, by default, 3 worker processes. The
main process will restart a new worker process to replace a dead worker.

Each worker process starts a socket.io server and connects to the main process
using the cluster adapter.

Then each worker creates 3 connections to the redis instance, being a
subscriber, a publisher, and a normal IO connection. The publisher/subscriber
pair are used to maintain the socket.io connections in sync with other servers
connected to the same redis instance. The IO connection is used to get and store
information as keys from redis.

redis is a REmote DIctionary Server, and stores key/value pairs.  In this
project, we use the keys to store JSON strings that represent some data
structures.

The socket.io connections are used to exchange messages in real time with the
clients. Each message triggers an event which are handled and the result is
reflected to the state in redis, if necessary.

The server is stateless and all the state is stored in redis. This allow servers
to be added or removed almost transparently. This will help us scale up and
down.

## More details

The core of the implementation are two parts: the services and the event
handlers.

The event handlers (in ``src/events``) react to events triggered by messages
from socket.io and request the services to process the request.

The services (in ``src/server``) implement the abstraction of units responsible
for providing functionality to change the state stored in redis.

Currently, the following services are implemented:

* Redis service: get and store data from redis
* Users service: manipulates users (create, update, destroy, etc)
* Rooms service: manipulate rooms
* Server service: provide access to the socket.io namespace (io) and the express
    (ex) singleton instances.

The services are implemented as classes, which provide functionality through
class methods.

When the server is started, the services are initialized, creating their
singleton instances. Then when the events are triggered by messages from the
socket.io connection, the event handlers can call the class methods to execute
asynchronously the request.

To prevent conflicts and inconsistent states when modifying data in redis, we
use transactions with optimistic locks provided by the ``watch`` function from
redis.

Using ``watch`` we can set a list of keys that we are modifying in a
transaction. If any of the keys were modified in parallel, the transaction is
not applied and should be resubmitted.

Currently we retry up to 5 times when the transaction was interrupted due to
conflict.  The transactions are not resubmitted case they were interrupted by
other errors.
