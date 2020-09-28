const autobahn = require('autobahn');

const connection = new autobahn.Connection({ url: 'wss://indoorlocationapp.herokuapp.com/ws/', realm: 'realm1' });

connection.onopen = function (session) {
    console.log('Connected');
    session.subscribe('onLocationUpdate', event => {
        console.log('Event:', event);
    });
};

connection.open();

