/**
 * Values of the items sold in shops and stalls.
 *
 * Guests always buy an item when its price is at or below the item's value (and get
 * happier from it). Above the value, guests may refuse depending on their happiness.
 * The value depends on the current temperature in the park.
 *
 * Data taken from OpenRCT2 (src/openrct2/ride/ShopItem.cpp), in game money units of 0.10.
 * On-ride photos, vouchers and empty containers are left out on purpose.
 */

export enum shopItemCol {
    Name,
    BaseValue,
    HotValue,
    ColdValue
}

/** Shop item id (as used by the game) => [name, base value, hot value, cold value] */
export const shopItemData: { [item: number]: [string, number, number, number] } = {
    0: ["Balloon", 14, 14, 14], // balloon
    1: ["Cuddly toy", 30, 30, 30], // toy
    2: ["Park map", 7, 7, 8], // map
    4: ["Umbrella", 35, 25, 50], // umbrella
    5: ["Drink", 12, 20, 10], // drink
    6: ["Burger", 19, 19, 22], // burger
    7: ["Chips", 16, 16, 18], // chips
    8: ["Ice cream", 10, 15, 6], // iceCream
    9: ["Candyfloss", 9, 9, 6], // candyfloss
    13: ["Pizza", 21, 21, 25], // pizza
    15: ["Popcorn", 13, 13, 11], // popcorn
    16: ["Hot dog", 17, 17, 20], // hotDog
    17: ["Tentacle", 22, 20, 18], // tentacle
    18: ["Hat", 27, 32, 24], // hat
    19: ["Toffee apple", 10, 10, 10], // toffeeApple
    20: ["T-shirt", 37, 37, 37], // tShirt
    21: ["Doughnut", 8, 7, 10], // doughnut
    22: ["Coffee", 11, 15, 20], // coffee
    24: ["Fried chicken", 19, 19, 22], // chicken
    25: ["Lemonade", 11, 21, 10], // lemonade
    32: ["Pretzel", 11, 11, 11], // pretzel
    33: ["Hot chocolate", 13, 13, 20], // chocolate
    34: ["Iced tea", 10, 20, 10], // icedTea
    35: ["Funnel cake", 13, 11, 14], // funnelCake
    36: ["Sunglasses", 15, 20, 12], // sunglasses
    37: ["Beef noodles", 17, 17, 20], // beefNoodles
    38: ["Fried rice noodles", 17, 17, 20], // friedRiceNoodles
    39: ["Wonton soup", 13, 13, 15], // wontonSoup
    40: ["Meatball soup", 14, 14, 16], // meatballSoup
    41: ["Fruit juice", 11, 19, 11], // fruitJuice
    42: ["Soybean milk", 10, 14, 10], // soybeanMilk
    43: ["Sujeonggwa", 11, 14, 11], // sujeonggwa
    44: ["Sub sandwich", 19, 19, 17], // subSandwich
    45: ["Cookie", 8, 8, 8], // cookie
    49: ["Roast sausage", 16, 16, 20], // roastSausage
}

/** Shop item id the game uses for "no item" */
export const noShopItem = 255

/**
 * Temperature thresholds of the default climates (°C). Custom climate objects
 * may use different ones, which the plugin API doesn't expose.
 */
const warmThreshold = 21
const coldThreshold = 11

/** @returns which value column applies at the current park temperature */
function getValueColumn(): shopItemCol {
    if (typeof climate === "undefined" || !climate.current) return shopItemCol.BaseValue
    const temperature = climate.current.temperature
    if (temperature >= warmThreshold) return shopItemCol.HotValue
    if (temperature <= coldThreshold) return shopItemCol.ColdValue
    return shopItemCol.BaseValue
}

/** @returns true when the plugin knows the value of this shop item */
export function isKnownShopItem(item: number): boolean {
    return item !== noShopItem && shopItemData[item] !== undefined
}

/** @returns the current value of a shop item in game money units, or undefined if unknown */
export function getShopItemValue(item: number): number | undefined {
    if (!isKnownShopItem(item)) return undefined
    return shopItemData[item][getValueColumn()] as number
}

/** @returns a readable name of a shop item */
export function getShopItemName(item: number): string {
    return isKnownShopItem(item) ? shopItemData[item][shopItemCol.Name] : "Item"
}
