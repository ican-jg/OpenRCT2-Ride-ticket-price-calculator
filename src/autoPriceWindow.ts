import { button, checkbox, Colour, compute, horizontal, label, store, twoway, vertical, window, WindowTemplate, WritableStore } from "openrct2-flexui";
import { AutoPriceSetting, canBeAutoPriced, getMaxPrice, getPriceTargets, getSetting, isAutoPriced, onAutoPriceChange, ridePricesUnlocked, setAutoPriced, setAutoPricedMany, setSetting, updateAllAutoPricedRides } from "./autoPrice";

/**
 * Windows with a list of rides (or shops, stalls and toilets) in the park, each with a
 * checkbox to select whether its prices should be updated automatically in the background.
 * Rides and everything else are shown in two separate windows for a better overview.
 */

const windowColour = Colour.DarkBrown
const rowsPerPage = 15
const priceColumnWidth = 110

/** Which kind of entries a window lists */
type ListKind = "rides" | "shops"

/** Ride or shop shown in a list */
interface RideEntry {
    id: number
    name: string
}

/** Formats a price in game money units */
function formatPrice(price: number): string {
    return context.formatString("{CURRENCY2DP}", price)
}

/** Stores for the settings checkboxes, shared by both windows */
const settingStores: { [key in AutoPriceSetting]: WritableStore<boolean> } = {
    showPriceMessages: store<boolean>(false),
    priceParkMaps: store<boolean>(false),
    umbrellasAtMax: store<boolean>(false)
}

/** Creates a checkbox for one of the automatic price settings */
function settingCheckbox(key: AutoPriceSetting, text: string, tooltip: string) {
    return checkbox({
        text: text,
        tooltip: tooltip,
        isChecked: twoway(settingStores[key]),
        onChange: (isChecked: boolean) => setSetting(key, isChecked)
    })
}

/** Loads the current settings into the checkboxes */
function loadSettings(): void {
    let key: AutoPriceSetting
    for (key in settingStores) settingStores[key].set(getSetting(key))
}

/** Creates one list window for either rides or shops */
function createListWindow(kind: ListKind): WindowTemplate {
    let entries: RideEntry[] = []
    let windowIsOpen = false
    let tickCounter = 0

    const currentPage = store<number>(0)
    const pageCount = store<number>(1)
    const warning = store<string>("")

    /** Stores for every visible row in the list */
    const rows: Array<{
        rideId: number
        name: WritableStore<string>
        checked: WritableStore<boolean>
        price: WritableStore<string>
        visible: WritableStore<"visible" | "none">
    }> = []
    for (let i = 0; i < rowsPerPage; i++) {
        rows.push({
            rideId: -1,
            name: store<string>(""),
            checked: store<boolean>(false),
            price: store<string>(""),
            visible: store<"visible" | "none">("none")
        })
    }

    /** Reads the rides or shops of this list from the park, sorted by name */
    function loadEntries(): void {
        entries = []
        map.rides.forEach(ride => {
            if (!canBeAutoPriced(ride)) return
            const isRide = ride.classification == "ride"
            if (isRide === (kind === "rides")) {
                entries.push({ id: ride.id, name: ride.name })
            }
        })
        entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
        pageCount.set(Math.max(1, Math.ceil(entries.length / rowsPerPage)))
        if (currentPage.get() >= pageCount.get()) currentPage.set(pageCount.get() - 1)
    }

    /** Updates the visible rows for the current page */
    function refreshRows(): void {
        const offset = currentPage.get() * rowsPerPage
        for (let i = 0; i < rowsPerPage; i++) {
            const row = rows[i]
            const entry = entries[offset + i]
            if (!entry) {
                row.rideId = -1
                row.visible.set("none")
                continue
            }
            row.rideId = entry.id
            row.name.set(entry.name)
            row.checked.set(isAutoPriced(entry.id))

            const ride = map.getRide(entry.id)
            if (ride) {
                // Shows the first price the plugin sets: the ticket of a ride, or the main item of a shop
                const targets = getPriceTargets(ride)
                const priceIndex = targets.length > 0 ? targets[0].priceIndex : 0
                const target = targets.length > 0 ? targets[0].price : (kind === "rides" ? getMaxPrice(ride) : undefined)
                const currentPrice = ride.price.length > priceIndex ? ride.price[priceIndex] : undefined
                const current = currentPrice === undefined ? "-" : formatPrice(currentPrice)
                const targetText = target === undefined ? "-" : formatPrice(target)
                const colour = target !== undefined && currentPrice === target ? "{BLACK}" : "{GREY}"
                row.price.set(`${colour}${current} / ${targetText}`)
            } else {
                row.price.set("")
            }
            row.visible.set("visible")
        }
        if (kind === "rides") {
            warning.set(ridePricesUnlocked() ? "" : "{RED}Ride prices are locked (park charges entry fee)")
        }
    }

    /** Reloads the entries and redraws the list */
    function refresh(): void {
        if (!windowIsOpen) return
        loadEntries()
        refreshRows()
    }

    /** Called when the user clicks the checkbox in a row */
    function onRowToggled(rowIndex: number, isChecked: boolean): void {
        const rideId = rows[rowIndex].rideId
        if (rideId < 0) return
        if (isAutoPriced(rideId) === isChecked) return
        setAutoPriced(rideId, isChecked)
    }

    function changePage(delta: number): void {
        const page = Math.max(0, Math.min(pageCount.get() - 1, currentPage.get() + delta))
        currentPage.set(page)
        refreshRows()
    }

    const rowWidgets = rows.map((row, index) => horizontal({
        content: [
            checkbox({
                visibility: row.visible,
                text: row.name,
                isChecked: row.checked,
                onChange: (isChecked: boolean) => onRowToggled(index, isChecked)
            }),
            label({
                visibility: row.visible,
                width: priceColumnWidth,
                text: row.price
            })
        ]
    }))

    const description = (kind === "rides")
        ? [label({ text: "Checked rides get the maximum ticket price." })]
        : [
            label({ text: "Shops: each item set to its value (depends on temperature)." }),
            label({ text: "Toilets: set to " + formatPrice(4) + "." })
        ]

    const options = (kind === "rides")
        ? []
        : [
            settingCheckbox("priceParkMaps", "Also set the price of park maps",
                "Off: park map prices are left as you set them (e.g. free maps). On: maps are sold at their value."),
            settingCheckbox("umbrellasAtMax", "Umbrellas always at " + formatPrice(200),
                "When it rains, guests buy umbrellas at any price they can afford. Without rain hardly anyone buys them at this price.")
        ]

    // Redraw the list when prices or the selection change in the background
    onAutoPriceChange(() => {
        if (windowIsOpen) refreshRows()
    })

    return window({
        title: kind === "rides" ? "Automatic ride prices" : "Automatic shop prices",
        width: 320,
        height: "auto",
        colours: [windowColour, windowColour],
        onOpen: () => {
            windowIsOpen = true
            tickCounter = 0
            loadSettings()
            refresh()
        },
        onUpdate: () => {
            // Refresh the list about once per second
            if (++tickCounter % 40 === 0) refresh()
        },
        onClose: () => windowIsOpen = false,
        content: [
            ...description,
            horizontal([
                label({ text: kind === "rides" ? "{BLACK}Ride" : "{BLACK}Shop / stall / toilet" }),
                label({ width: priceColumnWidth, text: "{BLACK}Current / target" })
            ]),
            vertical({
                content: rowWidgets
            }),
            horizontal([
                button({
                    text: "<",
                    width: 24, height: 14,
                    onClick: () => changePage(-1)
                }),
                label({
                    alignment: "centred",
                    text: compute(currentPage, pageCount, (page, count) => `Page ${page + 1} / ${count}`)
                }),
                button({
                    text: ">",
                    width: 24, height: 14,
                    onClick: () => changePage(1)
                })
            ]),
            horizontal([
                button({
                    text: "Select all",
                    height: 14,
                    onClick: () => {
                        setAutoPricedMany(entries.map(r => r.id), true)
                        refreshRows()
                    }
                }),
                button({
                    text: "Select none",
                    height: 14,
                    onClick: () => {
                        setAutoPricedMany(entries.map(r => r.id), false)
                        refreshRows()
                    }
                }),
                button({
                    text: "Update now",
                    height: 14,
                    onClick: () => {
                        updateAllAutoPricedRides()
                        refreshRows()
                    }
                })
            ]),
            ...options,
            settingCheckbox("showPriceMessages", "Show in-game message when a price changes",
                "Posts a message in the news bar each time a price is updated automatically (rides and shops)"),
            label({
                text: warning
            })
        ]
    })
}

/** Window for the automatic ticket prices of rides */
export const autoRidePriceWindow: WindowTemplate = createListWindow("rides")

/** Window for the automatic prices of shops, stalls and toilets */
export const autoShopPriceWindow: WindowTemplate = createListWindow("shops")
