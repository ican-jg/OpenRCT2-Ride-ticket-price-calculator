/**
 * Automatic background price updates.
 *
 * Keeps a list of rides and shops/stalls (by their in-park id) that the user selected
 * for automatic pricing. Once per in-game day (and whenever the selection changes):
 * - rides get their maximum ticket price,
 * - shops/stalls get each item priced at its current value (depends on the temperature),
 *   with options for park maps (not changed by default) and umbrellas (always £20.00),
 * - toilets get the highest price guests that look for a toilet always pay.
 * The selection is stored in the park file, so it survives saving and loading.
 */

import { calculateRidePrices } from "./calcFunctions"
import { pluginName } from "./pluginName"
import { getRideValueAge, hasMultipleOfRideType, parkChargesEntrance } from "./parkInfo"
import { ageTableCol, rideAgeArray, rideDataArray, rideTableCol } from "./rideData"
import { getShopItemName, getShopItemValue, isKnownShopItem, shopItemMap, shopItemUmbrella } from "./shopItems"

/** Key used in the park storage for the list of auto priced ride ids */
const storageKey = "autoPricedRides"

/** Boolean settings of the automatic prices, with their key in the park storage */
export type AutoPriceSetting = "showPriceMessages" | "priceParkMaps" | "umbrellasAtMax"
const settingDefaults: { [key in AutoPriceSetting]: boolean } = {
    showPriceMessages: false,
    priceParkMaps: false,
    umbrellasAtMax: false
}
const settings: { [key in AutoPriceSetting]: boolean } = {
    showPriceMessages: false,
    priceParkMaps: false,
    umbrellasAtMax: false
}

/** In-game ride type of toilets */
const toiletRideType = 36

/**
 * Price of toilets: guests only pay when price × 40 ≤ their toilet need (0-255),
 * and they start looking for a toilet at a need of 160, so £0.40 is always paid by them.
 */
const toiletPrice = 4

/** Highest ticket price the game accepts (£20.00, in money units of 0.10) */
const maxRidePrice = 200

/** In-park ids of rides that get their price updated automatically */
let autoPricedRides: number[] = []

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
    let key: AutoPriceSetting
    for (key in settingDefaults) {
        settings[key] = storage ? storage.get<boolean>(key, settingDefaults[key]) : settingDefaults[key]
    }
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

/** @returns the current value of a setting */
export function getSetting(key: AutoPriceSetting): boolean {
    return settings[key]
}

/** Changes a setting, saves it with the park and applies prices again if needed */
export function setSetting(key: AutoPriceSetting, enabled: boolean): void {
    if (settings[key] === enabled) return
    settings[key] = enabled
    const storage = getStorage()
    if (storage) storage.set(key, enabled)
    if (key !== "showPriceMessages") updateAllAutoPricedRides()
    notifyChange()
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

/** One price of a ride or shop that the plugin sets automatically */
export interface PriceTarget {
    /** index in ride.price */
    priceIndex: number
    /** price the plugin wants to set, in game money units */
    price: number
    /** what is sold, e.g. "ticket" or "Burger" */
    label: string
}

/** @returns true when the ride is a toilet block */
function isToilet(ride: Ride): boolean {
    return ride.classification == "facility" && ride.type == toiletRideType
}

/** @returns true when the plugin can price this ride or shop automatically */
export function canBeAutoPriced(ride: Ride): boolean {
    if (ride.classification == "ride") return true
    if (isToilet(ride)) return true
    if (ride.classification == "stall") {
        return isKnownShopItem(ride.object.shopItem) || isKnownShopItem(ride.object.shopItemSecondary)
    }
    return false
}

/**
 * @returns the prices the plugin would set for a ride (ticket) or shop (one per item).
 * Empty when nothing can be calculated right now (e.g. ride without ratings, prices locked).
 */
export function getPriceTargets(ride: Ride): PriceTarget[] {
    const targets: PriceTarget[] = []
    if (park.getFlag("noMoney")) return targets

    if (ride.classification == "ride") {
        const maxPrice = getMaxPrice(ride)
        if (maxPrice !== undefined && ridePricesUnlocked()) {
            targets.push({ priceIndex: 0, price: maxPrice, label: "ticket" })
        }
    } else if (isToilet(ride)) {
        targets.push({ priceIndex: 0, price: toiletPrice, label: "Toilet" })
    } else if (ride.classification == "stall") {
        const items = [ride.object.shopItem, ride.object.shopItemSecondary]
        for (let i = 0; i < items.length; i++) {
            if (i >= ride.price.length) continue
            if (items[i] === shopItemMap && !settings.priceParkMaps) continue
            let value = getShopItemValue(items[i])
            if (items[i] === shopItemUmbrella && settings.umbrellasAtMax) value = maxRidePrice
            if (value === undefined) continue
            targets.push({ priceIndex: i, price: Math.min(maxRidePrice, value), label: getShopItemName(items[i]) })
        }
    }
    return targets
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
 * Sets the prices of one ride or shop to the calculated values, if needed.
 * @returns true when a new price was applied
 */
function updateRidePrice(rideId: number): boolean {
    const ride = getRideSafe(rideId)
    if (!ride) return false
    const targets = getPriceTargets(ride)
    const rideName = ride.name
    const isShop = ride.classification != "ride"
    let changed = false

    for (let i = 0; i < targets.length; i++) {
        const target = targets[i]
        const oldPrice = ride.price[target.priceIndex]
        if (oldPrice === target.price) continue

        changed = true
        const args = { ride: rideId, price: target.price, isPrimaryPrice: target.priceIndex === 0 }
        context.executeAction("ridesetprice", args, result => {
            if (!settings.showPriceMessages || (result && result.error)) return
            const what = isShop ? `${target.label} price` : "ticket price"
            park.postMessage({
                type: "attraction",
                subject: rideId,
                text: `${rideName}: ${what} changed from ${formatPrice(oldPrice)} to ${formatPrice(target.price)}`
            })
        })
    }
    return changed
}

/** Removes rides from the selection that were demolished or can't be priced anymore */
function removeMissingRides(): boolean {
    let changed = false
    for (let i = autoPricedRides.length - 1; i >= 0; i--) {
        const ride = getRideSafe(autoPricedRides[i])
        if (!ride || !canBeAutoPriced(ride)) {
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
