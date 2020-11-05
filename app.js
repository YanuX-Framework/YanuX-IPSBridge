#!/usr/bin/env node

const io = require('socket.io-client');
const feathers = require('@feathersjs/feathers');
const socketio = require('@feathersjs/socketio-client');
const auth = require('@feathersjs/authentication-client');

const config = require('./config');

const IndoorAppServerConnection = require('./src/IndoorAppServerConnection');

const main = () => {
    console.log('YanuX IPS Bridge');

    const socket = io(config.yanux_broker.url, {
        transports: ['websocket'],
        forceNew: true
    });

    const client = feathers();
    client.configure(socketio(socket));
    client.configure(auth());

    const init = async () => {
        try {
            const authenticationResult = await client.authenticate(config.yanux_broker.authentication);

            console.log('YanuX Broker Authenticated:', authenticationResult);

            const locationService = client.service('locations');

            const conn = new IndoorAppServerConnection(
                config.indoorapp_server.url,
                config.indoorapp_server.realm,
                config.indoorapp_server.authentication.principal,
                config.indoorapp_server.authentication.ticket,
                locationService,
                config.inactive_location_timeout
            );
            conn.connect();

            process.on('SIGINT', function () {
                console.log('Disconnecting from YanuX Broker and Indoor App Server');
                conn.disconnect();
                client.logout();
                process.exit(0);
            });
        } catch (e) {
            console.error('Error:', e, '\nRetrying in:', config.retry_timer);
            setTimeout(init, config.retry_timer);
        }
    }
    init();
}
main();