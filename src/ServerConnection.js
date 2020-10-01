const autobahn = require('autobahn');

module.exports = class ServerConnection {
    constructor(url, realm = "realm1") {
        this.url = url;
        this.realm = realm;
        this.connection = new autobahn.Connection({ url: this.url, realm: this.realm });
        this.connection.onopen = function (session) {
            console.log('Connected');
            session.subscribe('onLocationUpdate', event => {
                console.log('Event:', event);
            });
        };
    }
    connect() { this.connection.open(); }
}