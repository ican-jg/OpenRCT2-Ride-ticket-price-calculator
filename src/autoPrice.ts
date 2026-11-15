/**
 * Automatic background price updates.
 *
 * Keeps a list of rides (by their in-park id) that the user selected for automatic
 * pricing. Once per in-game day (and whenever the selection changes) the maximum
 * ticket price for each of these rides is calculated and applied to the ride.
 * The selection is stored in the park file, so it survives saving and loading.
 */

import { calculateRidePrices } from "./calcFunctions"
import { pluginName } from "./pluginName"
import { getRideValueAge, hasMultipleOfRideType, parkChargesEntrance } from "./parkInfo"
import { ageTableCol, rideAgeArray, rideDataArray, rideTableCol } from "./rideData"

/** Key used in the park storage for the list of auto priced ride ids */
const storageKey = "autoPricedRides"

/** Key used in the park storage for the "show messages" setting */
const showMessagesKey = "showPriceMessages"

/** Highest ticket price the game accepts (£20.00, in money units of 0.10) */
const maxRidePrice = 200

/** In-park ids of rides that get their price updated automatically */
let autoPricedRides: number[] = []

/** When true, an in-game message is posted whenever a price is changed automatically */
let showMessages = false

/** Listeners that want to know when the selection or prices changed (e.g. UI) */
const changeListeners: Array<() => void> = []

/** Returns the park storage of this plugin, if available in this OpenRCT2 version */
function getStorage(): Configuration | undefined {
    if (typeof context.getParkStorage !== "function") return undefined
    return context.getParkStorage(pluginName)
}

/** Loads the selection from the park storage */
function loadSelection(): void {
    const storage = getStorage()
    const stored = storage ? storage.get<number[]>(storageKey, []) : []
    autoPricedRides = stored ? stored.slice() : []
    showMessages = storage ? storage.get<boolean>(showMessagesKey, false) : false
}

/** Saves the selection to the park storage */
function saveSelection(): void {
    const storage = getStorage()
    if (storage) storage.set(storageKey, autoPricedRides.slice())
}

/** Notifies all listeners about a change */
function notifyChange(): void {
    for (let i = 0; i < changeListeners.length; i++) {
        changeListeners[i]()
    }
}

/** @returns true when in-game messages for automatic price changes are enabled */
export function getShowMessages(): boolean {
    return showMessages
}

/** Enables or disables in-game messages for automatic price changes */
export function setShowMessages(enabled: boolean): void {
    if (showMessages === enabled) return
    showMessages = enabled
    const storage = getStorage()
    if (storage) storage.set(showMessagesKey, enabled)
}

/** Formats a price in game money units */
function formatPrice(price: number): string {
    return context.formatString("{CURRENCY2DP}", price)
}

/** Registers a callback that is called whenever the selection or the prices change */
export function onAutoPriceChange(callback: () => void): void {
    changeListeners.push(callback)
}

/** @returns true when the ride with the given in-park id is priced automatically */
export function isAutoPriced(rideId: number): boolean {
    return autoPricedRides.indexOf(rideId) !== -1
}

/**
 * Enables or disables automatic pricing for one ride.
 * When enabled, the price is updated right away.
 */
export function setAutoPriced(rideId: number, enabled: boolean): void {
    const index = autoPricedRides.indexOf(rideId)
    if (enabled && index === -1) {
        autoPricedRides.push(rideId)
        saveSelection()
        updateRidePrice(rideId)
        notifyChange()
    } else if (!enabled && index !== -1) {
        autoPricedRides.splice(index, 1)
        saveSelection()
        notifyChange()
    }
}

/** Enables or disables automatic pricing for a list of rides at once */
export function setAutoPricedMany(rideIds: number[], enabled: boolean): void {
    for (let i = 0; i < rideIds.length; i++) {
        const index = autoPricedRides.indexOf(rideIds[i])
        if (enabled && index === -1) autoPricedRides.push(rideIds[i])
        if (!enabled && index !== -1) autoPricedRides.splice(index, 1)
    }
    saveSelection()
    if (enabled) updateAllAutoPricedRides()
    notifyChange()
}

/** @returns true when guests are charged for rides, i.e. ride prices can be set */
export function ridePricesUnlocked(): boolean {
    if (park.getFlag("noMoney")) return false
    return park.getFlag("freeParkEntry") || park.getFlag("unlockAllPrices")
}

/** @returns the row index in rideDataArray for an in-game ride type, or -1 */
function getRideDataIndex(rideType: number): number {
    for (let i = 0; i < rideDataArray.length; i++) {
        if (rideDataArray[i][rideTableCol.RideType] == rideType) return i
    }
    return -1
}

/** @returns the row index in rideAgeArray matching the age of a ride in months */
function getAgeIndex(age: number): number {
    for (let i = rideAgeArray.length - 1; i >= 0; i--) {
        if (age >= rideAgeArray[i][ageTableCol.Age]) return i
    }
    return 0
}

/**
 * Calculates the current maximum ticket price of a ride in the park.
 * @returns price in game money units, or undefined if it can't be calculated (e.g. no ratings yet)
 */
export function getMaxPrice(ride: Ride): number | undefined {
    if (ride.classification != "ride") return undefined
    if (ride.excitement < 0) return undefined
    const dataIndex = getRideDataIndex(ride.type)
    if (dataIndex < 0) return undefined

    const prices = calculateRidePrices(dataIndex, ride.excitement, ride.intensity, ride.nausea,
        hasMultipleOfRideType(ride), parkChargesEntrance())
    const price = prices[getAgeIndex(getRideValueAge(ride))]
    return Math.max(0, Math.min(maxRidePrice, price))
}

/** Gets a ride from the map without throwing if it doesn't exist anymore */
function getRideSafe(rideId: number): Ride | null {
    try {
        return map.getRide(rideId)
    } catch (e) {
        return null
    }
}

/**
 * Sets the price of one ride to its maximum ticket price, if needed.
 * @returns true when a new price was applied
 */
function updateRidePrice(rideId: number): boolean {
    if (!ridePricesUnlocked()) return false
    const ride = getRideSafe(rideId)
    if (!ride) return false
    const newPrice = getMaxPrice(ride)
    if (newPrice === undefined) return false
    const oldPrice = ride.price.length > 0 ? ride.price[0] : 0
    if (oldPrice === newPrice) return false

    const rideName = ride.name
    context.executeAction("ridesetprice", { ride: rideId, price: newPrice, isPrimaryPrice: true }, result => {
        if (!showMessages || (result && result.error)) return
        park.postMessage({
            type: "attraction",
            subject: rideId,
            text: `${rideName}: ticket price changed from ${formatPrice(oldPrice)} to ${formatPrice(newPrice)}`
        })
    })
    return true
}

/** Removes rides from the selection that were demolished or are no longer rides */
function removeMissingRides(): boolean {
    let changed = false
    for (let i = autoPricedRides.length - 1; i >= 0; i--) {
        const ride = getRideSafe(autoPricedRides[i])
        if (!ride || ride.classification != "ride") {
            autoPricedRides.splice(i, 1)
            changed = true
        }
    }
    if (changed) saveSelection()
    return changed
}

/** Updates the price of all selected rides */
export function updateAllAutoPricedRides(): void {
    let changed = removeMissingRides()
    for (let i = 0; i < autoPricedRides.length; i++) {
        if (updateRidePrice(autoPricedRides[i])) changed = true
    }
    if (changed) notifyChange()
}

/** Loads the stored selection and starts the background updates */
export function initAutoPricing(): void {
    loadSelection()
    context.subscribe("interval.day", () => updateAllAutoPricedRides())
    updateAllAutoPricedRides()
}
