# Ride ticket price calculator for OpenRCT2

This plugin allows you to calculate the maximum ticket price of any ride, either one in your park or one that's made up.

![RTPC showcase](https://github.com/user-attachments/assets/36f6799d-d518-4a1f-9643-fc3ac6ec8462)

## Current features
- Select a ride in your park with either the dropdown or the ride picker.
- The current maximum ticket price will be highlighted in silver.
- Automatic updates when any of the variables relating to the currently selected ride change.
- Make up your own input to theorize the prices of any ride type with any stats.
- Automatic ticket prices: open "Automatic ticket prices..." and tick the rides whose ticket price should be kept at the maximum. The prices are updated in the background once per in-game day (e.g. when the ride ages or its ratings change), even when the window is closed. The selection is saved with the park.

## Installation

1. This plugin requires at least OpenRCT2 version v0.4.27 (it functions in earlier versions but the output will be wrong).
2. Download the latest version of the plugin from the [Releases page](https://github.com/MarcelVos96/OpenRCT2-Ride-ticket-price-calculator/releases).
3. To install it, put the downloaded `*.js` file into your `/OpenRCT2/plugin` folder.
    - Easiest way to find the OpenRCT2-folder is by launching the OpenRCT2 game, click and hold on the red toolbox in the main menu, and select "Open custom content folder".
    - Otherwise this folder is commonly found in `C:/Users/<YOUR NAME>/Documents/OpenRCT2/plugin` on Windows.
    - If you already had this plugin installed before, you can safely overwrite the old file.
4. Once the file is there, it should show up ingame in the dropdown menu under the map icon.

## Credits
- Designed and mostly written by Marcel Vos with a big thanks to Tygrysek90 for helping with this plugin and setting up the basics.
- Thanks to Basssiiie for creating the OpenRCT2-Simple-Typescript-Template and FlexUI library that are used in this plugin
