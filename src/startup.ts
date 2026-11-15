import { loadDataInDropDown, loadParkRidesInDropDown, onParkRideDropDownChange} from "./uiActions";
import { mainWindow, windowOpen } from "./mainWindow";
import { pluginName } from "./pluginName";
import { resetStats } from "./uiActions";
import { activateTool } from "./tool";
import { ridesInPark } from "./rideList";
import { viewModel, } from "./viewModel";
import { initAutoPricing } from "./autoPrice";

/**
 * Starting point
 */

const shortcutOpenWindow: ShortcutDesc = {
	id: "ride-ticket-price-calculator.open",
	text: pluginName,
	bindings: ["CTRL+E"],
	callback() {
		onPluginGUIopen()		
	}
}

const shortcutOpenWindowAndTool: ShortcutDesc = {
	id: "ride-ticket-price-calculator.tool-open",
	text: pluginName + " (activate selection tool)",
	bindings: ["CTRL+SHIFT+E"],
	callback() {
		onPluginGUIopen()		
		activateTool(true)
	}
}

function onPluginGUIopen() {
	loadDataInDropDown()
	loadParkRidesInDropDown()
	mainWindow.open()
	if (ridesInPark.length > 0 && viewModel.parkRideSelected.get() > 0) {
		onParkRideDropDownChange()
	} else {
		resetStats()
	}
}

export function startup()
{
	ui.registerShortcut(shortcutOpenWindow)
	ui.registerShortcut(shortcutOpenWindowAndTool)

	// Register a menu item under the map icon:
	if (typeof ui !== "undefined")
	{
		ui.registerMenuItem(pluginName, () => onPluginGUIopen());
	}

	// Start the background price updates for the rides selected by the user
	initAutoPricing()

	context.setInterval(
		function() {
			if (windowOpen && viewModel.autoUpdate.get()) {
				loadParkRidesInDropDown()
				onParkRideDropDownChange()
			} 
		}, 500
	);
}