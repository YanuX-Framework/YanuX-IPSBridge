const util = require('util');
const autobahn = require('autobahn');
const _ = require('lodash');
const { mod } = require('mathjs');
const { EMA: MovingAverage } = require('trading-signals');

module.exports = class IndoorAppServerConnection {
    constructor(url, realm, principal, ticket, locationService, inactiveLocationsTimeout = 3000, movingAveragePeriod = 3) {
        this.url = url;
        this.realm = realm;
        this.locationService = locationService;
        this.connection = new autobahn.Connection({
            url: this.url, realm: this.realm,
            authmethods: ["ticket"],
            authid: principal,
            onchallenge: () => ticket
        });
        this.inactiveLocationsTimeout = inactiveLocationsTimeout;
        this.inactiveLocationsInterval = null;
        this.movingAveragePeriod = movingAveragePeriod;
        this.movingAverages = {};
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
                    if (locationUpdate.position && !_.isArray(locationUpdate.position.Regression) && locationUpdate.beacon) {
                        location.proximity = {
                            distance: locationUpdate.position.Regression,
                            orientation: mod(-locationUpdate.orientation, 360),
                            zone: locationUpdate.position.Classification
                        };
                        const beaconMatches = locationUpdate.beacon.match(this.beaconRegex);
                        if (beaconMatches.length === 4) {
                            location.proximity.beacon = {
                                uuid: beaconMatches[1],
                                major: beaconMatches[2],
                                minor: beaconMatches[3]
                            };
                        }
                        if (location.proximity && location.proximity.beacon) {
                            const pId = location.deviceUuid + '-' + location.proximity.beacon.uuid + '-' + location.proximity.beacon.major + '-' + location.proximity.beacon.minor
                            console.log('pId:', pId);
                            if (!this.movingAverages[pId]) {
                                const movingAverage = new MovingAverage(this.movingAveragePeriod);
                                Array(this.movingAveragePeriod - 1).fill(location.proximity.distance).forEach(fillValue => {
                                    movingAverage.update(fillValue);
                                });
                                this.movingAverages[pId] = movingAverage;
                            }
                            this.movingAverages[pId].update(location.proximity.distance);
                            try { location.proximity.distance = this.movingAverages[pId].getResult().toNumber(); }
                            catch (e) { console.log('Distance Moving Average Still Not Available:', e.message); }
                        }
                        clearTimeout(this.inactiveLocationsTimer)
                    } else if (locationUpdate.position && _.isArray(locationUpdate.position.Regression)) {
                        let x = locationUpdate.position.Regression[0];
                        let y = locationUpdate.position.Regression[1];
                        if (!this.movingAverages[location.UUID]) {
                            const movingAverageX = new MovingAverage(this.movingAveragePeriod);
                            const movingAverageY = new MovingAverage(this.movingAveragePeriod);
                            Array(this.movingAveragePeriod - 1).fill(x).forEach(fillValue => {
                                movingAverageX.update(fillValue);
                            });
                            Array(this.movingAveragePeriod - 1).fill(y).forEach(fillValue => {
                                movingAverageY.update(fillValue);
                            });
                            this.movingAverages[location.UUID] = {
                                x: movingAverageX,
                                y: movingAverageY
                            }
                        }
                        this.movingAverages[location.UUID].x.update(x);
                        this.movingAverages[location.UUID].y.update(y);
                        try {
                            x = this.movingAverages[location.UUID].x.getResult().toNumber();
                            y = this.movingAverages[location.UUID].y.getResult().toNumber();
                            console.log('Moving Average (' + x + ', ' + y + ')');
                        } catch (e) {
                            console.log('Position Moving Average Still Not Available:', e.message);
                        }
                        location.position = {
                            x, y,
                            orientation: mod(-locationUpdate.orientation, 360),
                            place: locationUpdate.radio_map,
                            zone: locationUpdate.position.Classification
                        };
                        clearTimeout(this.inactiveLocationsTimer)
                    } else { console.error('>> UNKNOWN locationUpdate format!') }
                    return location;
                });
                console.log('> locations:', util.inspect(locations, false, null, true));
                try {
                    const locationUpdatesResults = await Promise.all(
                        locations.map(location => {
                            if (location.position || location.proximity) {
                                const query = {
                                    username: location.username,
                                    deviceUuid: location.deviceUuid
                                }
                                if (location.proximity && location.proximity.beacon) {
                                    query['proximity.beacon.uuid'] = location.proximity.beacon.uuid;
                                    query['proximity.beacon.major'] = location.proximity.beacon.major;
                                    query['proximity.beacon.minor'] = location.proximity.beacon.minor;
                                } else if (location.position) {
                                    query['position'] = { $exists: true };
                                }
                                return this.locationService ? this.locationService.patch(null, location, { query }) : Promise.resolve(null);
                            }
                        })
                    );
                    console.log('>> Updated Locations:', util.inspect(locationUpdatesResults, false, null, true));
                } catch (e) { console.log('>> Error Updating Locations:', e); }

                this.inactiveLocationsTimer = setTimeout(async () => {
                    console.log('>> Clearing Inactive Locations...');
                    if (this.locationService) {
                        try {
                            const removedInactiveLocations = await this.locationService.remove(null,
                                { query: { timestamp: { $lt: new Date().getTime() - this.inactiveLocationsTimeout } } }
                            );
                            removedInactiveLocations.forEach(location => {
                                if (location.proximity && location.proximity.beacon) {
                                    delete this.movingAverages[location.deviceUuid + '-' + location.proximity.beacon.uuid + '-' + location.proximity.beacon.major + '-' + location.proximity.beacon.minor]
                                } else { delete this.movingAverages[location.UUID]; }
                            });
                            console.log('>>> Removed Inactive Locations:', util.inspect(removedInactiveLocations, false, null, true));
                        } catch (e) { console.error('>> Error Removing Inactive Locations:', e.message); }
                    }
                }, this.inactiveLocationsTimeout);
            });
        };
        this.connection.onclose = () => {
            console.log('Disconnected from Indoor App Server.');
        };
    }
    connect() {
        this.connection.open();
    }
    disconnect() {
        this.connection.close('wamp.goodbye.normal', 'Disconnecting from server.');
    }
}