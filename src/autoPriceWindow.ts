import { button, checkbox, Colour, compute, dropdown, horizontal, label, store, twoway, vertical, window, WindowTemplate, WritableStore } from "openrct2-flexui";
import { canBeAutoPriced, getMaxPrice, getPriceTargets, getShowMessages, setShowMessages, isAutoPriced, onAutoPriceChange, ridePricesUnlocked, setAutoPriced, setAutoPricedMany, updateAllAutoPricedRides } from "./autoPrice";

/**
 * Window with a list of all rides in the park, each with a checkbox to select
 * whether its ticket price should be updated automatically in the background.
 */

const windowColour = Colour.DarkBrown
const rowsPerPage = 15
const priceColumnWidth = 110

/** Ride or shop shown in the list */
interface RideEntry {
    id: number
    name: string
    isShop: boolean
}

/** Filter options of the list */
const filterOptions = ["Rides and shops", "Rides only", "Shops and stalls only"]
const filter = store<number>(0)

/** All rides in the park, sorted by name */
let rideEntries: RideEntry[] = []
let windowIsOpen = false
let tickCounter = 0

const currentPage = store<number>(0)
const pageCount = store<number>(1)
const warning = store<string>("")
const showMessages = store<boolean>(false)

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

/** Formats a price in game money units */
function formatPrice(price: number): string {
    return context.formatString("{CURRENCY2DP}", price)
}

/** Reads all rides and shops from the park (rides first, then shops, each sorted by name) */
function loadRides(): void {
    rideEntries = []
    const showRides = filter.get() !== 2
    const showShops = filter.get() !== 1
    map.rides.forEach(ride => {
        if (!canBeAutoPriced(ride)) return
        const isShop = ride.classification != "ride"
        if ((isShop && showShops) || (!isShop && showRides)) {
            rideEntries.push({ id: ride.id, name: ride.name, isShop: isShop })
        }
    })
    rideEntries.sort((a, b) => {
        if (a.isShop !== b.isShop) return a.isShop ? 1 : -1
        return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
    })
    pageCount.set(Math.max(1, Math.ceil(rideEntries.length / rowsPerPage)))
    if (currentPage.get() >= pageCount.get()) currentPage.set(pageCount.get() - 1)
}

/** Updates the visible rows for the current page */
function refreshRows(): void {
    const offset = currentPage.get() * rowsPerPage
    for (let i = 0; i < rowsPerPage; i++) {
        const row = rows[i]
        const entry = rideEntries[offset + i]
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
            const target = targets.length > 0 ? targets[0].price : (entry.isShop ? undefined : getMaxPrice(ride))
            const currentPrice = ride.price.length > priceIndex ? ride.price[priceIndex] : undefined
            const current = currentPrice === undefined ? "-" : formatPrice(currentPrice)
            const targetText = target === undefined ? "?" : formatPrice(target)
            const colour = target !== undefined && currentPrice === target ? "{BLACK}" : "{GREY}"
            row.price.set(`${colour}${current} / ${targetText}`)
        } else {
            row.price.set("")
        }
        row.visible.set("visible")
    }
    warning.set(ridePricesUnlocked() ? "" : "{RED}Ride prices are locked (park charges entry fee), only shops are updated")
}

/** Reloads rides and redraws the list */
function refresh(): void {
    if (!windowIsOpen) return
    loadRides()
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

function createRow(index: number) {
    const row = rows[index]
    return horizontal({
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
    })
}

const rowWidgets = []
for (let i = 0; i < rowsPerPage; i++) {
    rowWidgets.push(createRow(i))
}

export const autoPriceWindow: WindowTemplate = window({
    title: "Automatic prices",
    width: 320,
    height: "auto",
    colours: [windowColour, windowColour],
    onOpen: () => {
        windowIsOpen = true
        tickCounter = 0
        showMessages.set(getShowMessages())
        refresh()
    },
    onUpdate: () => {
        // Refresh the list about once per second
        if (++tickCounter % 40 === 0) refresh()
    },
    onClose: () => windowIsOpen = false,
    content: [
        label({ text: "Rides: set to the maximum ticket price." }),
        label({ text: "Shops: each item set to its value (depends on temperature)." }),
        dropdown({
            items: filterOptions,
            selectedIndex: twoway(filter),
            onChange: () => {
                currentPage.set(0)
                refresh()
            }
        }),
        horizontal([
            label({ text: "{BLACK}Ride / shop" }),
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
                    setAutoPricedMany(rideEntries.map(r => r.id), true)
                    refreshRows()
                }
            }),
            button({
                text: "Select none",
                height: 14,
                onClick: () => {
                    setAutoPricedMany(rideEntries.map(r => r.id), false)
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
        checkbox({
            text: "Show in-game message when a price changes",
            tooltip: "Posts a message in the news bar each time a ride's price is updated automatically",
            isChecked: twoway(showMessages),
            onChange: (isChecked: boolean) => setShowMessages(isChecked)
        }),
        label({
            text: warning
        })
    ]
})

// Redraw the list when prices or the selection change in the background
onAutoPriceChange(() => {
    if (windowIsOpen) refreshRows()
})
