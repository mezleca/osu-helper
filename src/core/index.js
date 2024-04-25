import fs from "fs";
import Terminal from "terminal-kit";

import { missing_initialize, get_beatmaps_collector, download_all_maps_from_osu } from "./functions/missing_maps.js";
import { download_initialize } from "./functions/download_maps.js";
import { get_invalid_maps } from "./functions/collections.js";
import { check_login, show_menu } from "../other/utils.js";

export const login = await check_login();
export const terminal = Terminal.terminal;

terminal.grabInput();
terminal.on("key", (name) => {
    if (name === "CTRL_C") {
        process.exit();
    }
});

const menu_options = [
    {
        name: "get missing beatmaps from collections",
        callback: missing_initialize
    },
    {
        name: "download maps from a json",
        callback: download_initialize
    },
    {
        name: "remove invalid maps from collections",
        callback: get_invalid_maps
    },
    {
        name: "get beatmaps from osu!Collector",
        callback: get_beatmaps_collector
    },
    // {
    //     name: "fuck",
    //     callback: download_all_maps_from_osu
    // }
];

const main = async () => {

    console.clear();

    // check if the data path exist's
    if (!fs.existsSync("./data")) {
        fs.mkdirSync("./data");     
    }

    while (true) {
        console.log("osu-helper 0.7.0 | type exit to... exit?\n");
        await show_menu(menu_options);
    }
};

main();