const util = require('util');
const autobahn = require('autobahn');

module.exports = class ServerConnection {
    constructor(url, realm = "realm1") {
        this.url = url;
        this.realm = realm;
        this.connection = new autobahn.Connection({ url: this.url, realm: this.realm });
        this.connection.onopen = session => {
            console.log('Connected to Indoor Location Server');
            session.subscribe('onLocationUpdate', event => {
                console.log('onLocationUpdate:', util.inspect(event, false, null, true));
            });
        };
    }
    connect() { this.connection.open(); }
}