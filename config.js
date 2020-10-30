module.exports = {
    "indoorapp_server": {
        "url": process.env.INDOORAPP_SERVER_URL || "wss://yanux-ipsserver.herokuapp.com/ws/",
        "realm": process.env.INDOORAPP_SERVER_REALM || "realm1"
    },
    "yanux_broker": {
        "url": process.env.YANUX_BROKER_URL || "https://yanux-broker.herokuapp.com/",
        "authentication": {
            "strategy": process.env.YANUX_BROKER_AUTHENTICATION_STRATEGY || "local",
            "email": process.env.YANUX_BROKER_AUTHENTICATION_EMAIL || "admin@yanux.org",
            "password": process.env.YANUX_BROKER_AUTHENTICATION_PASSWORD || "admin"
        }
    },
    "inactive_location_timeout": process.env.INACTIVE_LOCATION_TIMEOUT || 7500,
    "retry_timer": process.env.RETRY_TIMER || 3000
}