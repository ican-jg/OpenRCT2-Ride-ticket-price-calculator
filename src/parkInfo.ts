/**
 * Detects the park conditions that influence the maximum ticket price,
 * following the rules OpenRCT2 itself uses.
 */

/** @returns the number of open rides of the given in-game ride type */
export function countOpenRidesOfType(rideType: number): number {
    let count = 0
    const rides = map.rides
    for (let i = 0; i < rides.length; i++) {
        if (rides[i].classification == "ride" && rides[i].type == rideType && rides[i].status === "open") count++
    }
    return count
}

/**
 * Whether the "multiple rides of the same type" penalty applies to a ride in the park.
 * The game applies it when more than one ride of that type is open (the ride itself included).
 */
export function hasMultipleOfRideType(ride: Ride): boolean {
    return countOpenRidesOfType(ride.type) > 1
}

/**
 * Whether the penalty would apply to a new (made up) ride of the given type once it is opened,
 * i.e. at least one ride of that type is already open in the park.
 */
export function wouldHaveMultipleOfRideType(rideType: number): boolean {
    return countOpenRidesOfType(rideType) >= 1
}

/**
 * Whether guests pay for entering the park. Guests that paid an entrance fee
 * are only willing to pay a quarter of the usual ticket price.
 */
export function parkChargesEntrance(): boolean {
    if (park.getFlag("noMoney")) return false
    return !park.getFlag("freeParkEntry") && park.entranceFee > 0
}

/** @returns the age of the ride in months as used for its value (0 when the "disable ride ageing" cheat is on) */
export function getRideValueAge(ride: Ride): number {
    if (typeof cheats !== "undefined" && cheats.disableRideValueAging) return 0
    return ride.age
}
