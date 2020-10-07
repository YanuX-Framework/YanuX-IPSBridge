const util = require('util');
const autobahn = require('autobahn');
const { throws } = require('assert');

module.exports = class IndoorAppServerConnection {
    constructor(url, realm, locationService, inactiveLocationsTimeout = 5000) {
        this.url = url;
        this.realm = realm;
        this.locationService = locationService;
        this.connection = new autobahn.Connection({ url: this.url, realm: this.realm });
        this.inactiveLocationsTimeout = inactiveLocationsTimeout;
        this.inactiveLocationsTimer = null;
        this.beaconRegex = /([ABCDEF0123456789]+\-[ABCDEF0123456789]+\-[ABCDEF0123456789]+\-[ABCDEF0123456789]+\-[ABCDEF0123456789]+)\-(\d+)\-(\d+)/i
        this.connection.onopen = session => {
            console.log('Connected to Indoor App Server');
            session.subscribe('onLocationUpdate', async locationUpdates => {
                console.log('> onLocationUpdate:', util.inspect(locationUpdates, false, null, true));
                const locations = locationUpdates.map(locationUpdate => {
                    const location = {
                        username: locationUpdate.username,
                        deviceUuid: locationUpdate.UUID,
                        timestamp: new Date()
                    };
                    //Preparing location object with proximity information.
                    if (locationUpdate.position) {
                        location.proximity = {
                            distance: locationUpdate.position.Regression,
                            zone: locationUpdate.position.Classification
                        };
                        if (locationUpdate.beacon) {
                            const beaconMatches = locationUpdate.beacon.match(this.beaconRegex);
                            if (beaconMatches.length === 4) {
                                location.proximity.beacon = {
                                    uuid: beaconMatches[1],
                                    major: beaconMatches[2],
                                    minor: beaconMatches[3]
                                };
                            }
                        }
                    }
                    //TODO: Prepare location object with positioning information based on fingerprinting or trilateration.
                    return location;
                });
                console.log('> locations:', util.inspect(locations, false, null, true));
                try {
                    const locationUpdatesResults = await Promise.all(
                        locations.map(location => {
                            const query = {
                                username: location.username,
                                deviceUuid: location.deviceUuid
                            }
                            if (location.proximity && location.proximity.beacon) {
                                query['proximity.beacon.uuid'] = location.proximity.beacon.uuid;
                                query['proximity.beacon.major'] = location.proximity.beacon.major;
                                query['proximity.beacon.minor'] = location.proximity.beacon.minor;
                            }
                            return this.locationService.patch(null, location, { query })
                        })
                    );
                    console.log('>> Updated Locations:', util.inspect(locationUpdatesResults, false, null, true));
                } catch (e) { console.log('>> Error Updating Locations:', e); }

                clearTimeout(this.inactiveLocationsTimer)
                this.inactiveLocationsTimer = setTimeout(async () => {
                    console.log('>> Clearing Inactive Locations...');
                    try {
                        const removedInactiveLocations = await this.locationService.remove(null,
                            { query: { timestamp: { $lt: new Date().getTime() - this.inactiveLocationsTimeout } } }
                        );
                        console.log('>>> Removed Inactive Locations:', util.inspect(removedInactiveLocations, false, null, true));
                    } catch (e) { console.error('>> Error Removing Inactive Locations:', e); }
                }, this.inactiveLocationsTimeout);
            });
        };
        this.connection.onclose = () => {
            console.log('Disconnected from Indoor App Server');
        };
    }
    connect() {
        this.connection.open();
     }
     disconnect() {
        this.connection.close('wamp.goodbye.normal', 'Disconnecting from server.');
     }
}