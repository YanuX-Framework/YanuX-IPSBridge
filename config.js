module.exports = {
    "indoorapp_server": {
        "url": process.env.INDOORAPP_SERVER_URL /*|| "wss://indoorlocationapp.herokuapp.com/ws/"*/ || "http://localhost:3101/ws/",
        "realm": process.env.INDOORAPP_SERVER_REALM || "realm1",
        "authentication": {
            "principal": process.env.INDOORAPP_SERVER_PRINCIPAL || "client1",
            "ticket": process.env.INDOORAPP_SERVER_PRINCIPAL || "secretticket"
        }
    },
    "yanux_broker": {
        "url": process.env.YANUX_BROKER_URL /*|| "https://yanux-broker.herokuapp.com/"*/ || "http://localhost:3002/",
        "authentication": {
            "strategy": process.env.YANUX_BROKER_AUTHENTICATION_STRATEGY || "local",
            "email": process.env.YANUX_BROKER_AUTHENTICATION_EMAIL || "admin@yanux.org",
            "password": process.env.YANUX_BROKER_AUTHENTICATION_PASSWORD || "admin"
        }
    },
    "inactive_location_timeout": process.env.INACTIVE_LOCATION_TIMEOUT || 6000,
    "retry_timer": process.env.RETRY_TIMER || 3000
}
