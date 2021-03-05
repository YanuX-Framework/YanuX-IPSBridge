# YanuX IPS Bridge
This component is part of the [__YanuX Framework__](https://yanux-framework.github.io/). It "bridges" the gap between the [__Indoor Positioning Server__](https://github.com/YanuX-Framework/YanuX-IPSServer) and the [__YanuX Broker__](https://github.com/YanuX-Framework/YanuX-Broker).

It is a [__Node.js__](https://nodejs.org/) daemon which connects to the [__Indoor Positioning Server__](https://github.com/YanuX-Framework/YanuX-IPSServer) using the [__autobahn__](https://github.com/crossbario/autobahn-js) library and subscribes to a topic published by the [__Indoor Positioning Server__](https://github.com/YanuX-Framework/YanuX-IPSServer) via the [__WAMP__](https://wamp-proto.org/) protocol.

## Documentation
The daemon can be configured through the [__config.js__](config.js) file. The example found on the repository should provide some insights but we wish to offer additional documentation in the future.

### TO DO:
- Provide additional documentation.

## License
This work is licensed under [__GNU Affero General Public License Version 3__](LICENSE)