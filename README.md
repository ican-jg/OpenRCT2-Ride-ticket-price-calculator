# Ride ticket price calculator for OpenRCT2

This plugin allows you to calculate the maximum ticket price of any ride, either one in your park or one that's made up. It can also keep the prices of selected rides and shops at their best value automatically.

![RTPC showcase](https://github.com/user-attachments/assets/36f6799d-d518-4a1f-9643-fc3ac6ec8462)

## Current features
- Select a ride in your park with either the dropdown or the ride picker.
- The current maximum ticket price will be highlighted in silver.
- Automatic updates when any of the variables relating to the currently selected ride change.
- Make up your own input to theorize the prices of any ride type with any stats.
- "Multiple of this ride type in the park" and "Charge for the park entrance" are detected automatically, using the same rules as the game:
    - Multiple: more than one ride of this type is open (the ride itself included). For a made-up ride type, it is ticked when at least one ride of that type is already open.
    - Entrance: the park charges an entrance fee greater than 0.
    - You can still click the checkboxes to override the detected values (this switches to manual input).
- Automatic prices for the rides and shops you select (see below).
- Optional in-game message whenever a price is changed automatically.

## Automatic prices
Click **"Automatic prices..."** at the bottom of the main window to open a list of all rides, shops and stalls in your park.

- Tick the checkbox of every ride or shop whose prices should be set automatically:
    - **Rides** get their maximum ticket price.
    - **Shops and stalls** sell each item at exactly its value. Guests always buy an item at or below its value (if they want it) and become happier from it; above the value, unhappy guests start refusing. The value depends on the temperature in the park, e.g. a drink is worth £1.20 normally, £2.00 when it's warm (21 °C and above) and £1.00 when it's cold (11 °C and below). Both items of a shop are priced (e.g. maps and umbrellas at the information kiosk).
- Each row shows the current price and the target price (black = already at the target). For shops this is the main item.
- Use the dropdown to show only rides or only shops. **Select all** / **Select none** change all entries in the list at once, **Update now** applies the prices immediately. With many entries, use `<` and `>` to switch pages.
- The prices are updated in the background once per in-game day, even when the window is closed. This keeps up with the ride getting older, new ratings, other rides of the same type opening, changes to the park entrance fee and the temperature.
- Tick **"Show in-game message when a price changes"** to get a message in the news bar each time a price is changed (e.g. *"Coaster: ticket price changed from £10.20 to £7.60"* or *"Burger Bar 1: Burger price changed from £1.90 to £2.20"*). Clicking the message opens the ride or shop. This is off by default.
- Rides without ratings yet are skipped. If the park charges an entrance fee and ride prices are locked, only shops are updated and the window shows a warning. In parks without money nothing is changed.
- If your park uses the same price for an item in all shops, changing it in one shop changes it everywhere (this is how the game works).
- Custom climates may use other temperature limits than 21 °C / 11 °C; the plugin always uses the default limits.
- Your selection and the message setting are saved with the park, so every park has its own settings.

## Installation

1. This plugin requires at least OpenRCT2 version v0.4.27 (it functions in earlier versions but the output will be wrong).
2. Download the latest version of the plugin from the [Releases page](https://github.com/ican-jg/OpenRCT2-Ride-ticket-price-calculator/releases).
3. To install it, put the downloaded `*.js` file into your `/OpenRCT2/plugin` folder.
    - Easiest way to find the OpenRCT2-folder is by launching the OpenRCT2 game, click and hold on the red toolbox in the main menu, and select "Open custom content folder".
    - Otherwise this folder is commonly found in `C:/Users/<YOUR NAME>/Documents/OpenRCT2/plugin` on Windows.
    - If you already had this plugin installed before, delete the old `Ride-ticket-price-calculator-v*.js` file so that only one version is loaded.
4. Once the file is there, it should show up ingame in the dropdown menu under the map icon. You can also open it with `CTRL+E`, or with `CTRL+SHIFT+E` to open it with the ride picker active.

## Development

1. Install [Node.js](https://nodejs.org/) and run `npm install`.
2. Put the `openrct2.d.ts` file into the `lib` folder (see [lib/put-openrct2.d.ts-here.md](lib/put-openrct2.d.ts-here.md)).
3. `npm run build:dev` builds the plugin straight into your OpenRCT2 plugin folder, `npm start` does so on every change. `npm run build` creates a release build in `dist/`.

### Releasing
Releases are created automatically by GitHub Actions (`.github/workflows/release.yml`):

1. Increase the version in `src/pluginVersion.ts`, the window title in `src/mainWindow.ts` and the file name in `rollup.config.js`.
2. Merge the change into `main`.
3. The workflow builds the plugin and creates the release `v<version>` with the plugin file attached, if that release doesn't exist yet. It can also be started manually from the Actions tab.

## Credits
- Designed and mostly written by Marcel Vos with a big thanks to Tygrysek90 for helping with this plugin and setting up the basics.
- Thanks to Basssiiie for creating the OpenRCT2-Simple-Typescript-Template and FlexUI library that are used in this plugin
