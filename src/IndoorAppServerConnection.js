const util = require('util');
const autobahn = require('autobahn');
const _ = require('lodash');
const { mod } = require('mathjs');
const { SMA: MovingAverage } = require('trading-signals');

//TODO: Remove if the headingVector is no longer necessary!
// const degToRad = v => v * Math.PI / 180;
// const headingVectorFromOrientation = orientation => [Math.cos(orientation), Math.sin(orientation)];

module.exports = class IndoorAppServerConnection {
    constructor(url, realm, principal, ticket, locationService, inactiveLocationsTimeout = 6000, movingAveragePeriod = 3) {
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
        this.devicePositionMovingAverages = {};
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
                    if (locationUpdate.position && !_.isArray(locationUpdate.position.Regression)) {
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
                    } else if (locationUpdate.position && _.isArray(locationUpdate.position.Regression)) {
                        if (!this.devicePositionMovingAverages[location.UUID]) {
                            this.devicePositionMovingAverages[location.UUID] = {
                                x: new MovingAverage(this.movingAveragePeriod),
                                y: new MovingAverage(this.movingAveragePeriod)
                            }
                        }
                        let x = locationUpdate.position.Regression[0];
                        let y = locationUpdate.position.Regression[1];

                        this.devicePositionMovingAverages[location.UUID].x.update(x);
                        this.devicePositionMovingAverages[location.UUID].y.update(y);
                        try {
                            x = this.devicePositionMovingAverages[location.UUID].x.getResult().toNumber();
                            y = this.devicePositionMovingAverages[location.UUID].y.getResult().toNumber();
                            console.log('Moving Average (' + x + ', ' + y + ')');
                        } catch (e) {
                            console.log('Moving Average Still Not Available:', e.message);
                        }
                        location.position = {
                            x, y,
                            orientation: mod(-locationUpdate.orientation, 360),
                            place: locationUpdate.radio_map,
                            zone: locationUpdate.position.Classification
                        };
                        //TODO: Remove if the headingVector is no longer necessary!
                        //location.position.headingVector = headingVectorFromOrientation(degToRad(location.position.orientation));
                    } else { console.error('>> UNKNOWN locationUpdate format!') }
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
                            } else if (location.position) {
                                query['position'] = { $exists: true };
                            }
                            return this.locationService ? this.locationService.patch(null, location, { query }) : Promise.resolve(null);
                        })
                    );
                    console.log('>> Updated Locations:', util.inspect(locationUpdatesResults, false, null, true));
                } catch (e) { console.log('>> Error Updating Locations:', e); }

                clearTimeout(this.inactiveLocationsTimer)
                this.inactiveLocationsTimer = setTimeout(async () => {
                    console.log('>> Clearing Inactive Locations...');
                    if (this.locationService) {
                        try {
                            const removedInactiveLocations = await this.locationService.remove(null,
                                { query: { timestamp: { $lt: new Date().getTime() - this.inactiveLocationsTimeout } } }
                            );
                            removedInactiveLocations.forEach(location => {
                                delete this.devicePositionMovingAverages[location.UUID]
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