const io = require('socket.io-client');
const feathers = require('@feathersjs/feathers');
const socketio = require('@feathersjs/socketio-client');
const auth = require('@feathersjs/authentication-client');

const IndoorAppServerConnection = require('./src/IndoorAppServerConnection');

const INDOORAPP_SERVER_URI = 'wss://indoorlocationapp.herokuapp.com/ws/';
const INDOORAPP_SERVER_REALM = 'realm1';
const YANUX_BROKER_URI = 'http://localhost:3002/';
const INACTIVE_LOCATIONS_TIMEOUT = 12000;
const RETRY_INIT_TIMER = 3000;

const main = () => {
    console.log('YanuX IPS Bridge');

    const socket = io(YANUX_BROKER_URI, {
        transports: ['websocket'],
        forceNew: true
    });
    const client = feathers();
    client.configure(socketio(socket));
    client.configure(auth());

    const init = async () => {
        try {
            await client.authenticate({
                strategy: 'local',
                email: 'admin@yanux.org',
                password: 'admin'
            });
            const locationService = client.service('locations');
            const conn = new IndoorAppServerConnection(
                INDOORAPP_SERVER_URI,
                INDOORAPP_SERVER_REALM,
                locationService,
                INACTIVE_LOCATIONS_TIMEOUT
            );
            conn.connect();
            process.on('SIGINT', function() {
                console.log('Disconnecting from YanuX Broker and Indoor App Server');
                conn.disconnect();
                client.logout();
                process.exit(0);
            });
        } catch (e) {
            console.error('Error:', e);
            setTimeout(init, RETRY_INIT_TIMER);
        }
    }
    init();
}

main();
