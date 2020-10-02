const ServerConnection = require('./src/ServerConnection');

const conn = new ServerConnection('wss://indoorlocationapp.herokuapp.com/ws/');

console.log('YanuX IPS Bridge');

conn.connect();