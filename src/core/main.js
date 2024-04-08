import fs from "fs";

import { missing_initialize, get_beatmaps_collector } from "./functions/missing_maps.js";
import { download_initialize } from "./functions/download_maps.js";
import { get_invalid_maps } from "./functions/collections.js";
import { check_login, handle_prompt } from "../other/utils.js";

export const login = await check_login();

let current_option = null;

const menu_options = [
    {
        name: "get missing beatmaps from collections",
        func: missing_initialize
    },
    {
        name: "download maps from a json",
        func: download_initialize
    },
    {
        name: "remove invalid maps from collections",
        func: get_invalid_maps
    },
    {
        name: "get beatmaps from osu!Collector",
        func: get_beatmaps_collector
    }
];

const select_option = async () => {

    for (let i = 0; i < menu_options.length; i++) {
        console.log(`[${i}] - ${menu_options[i].name}`);
    }

    console.log("\n");

    return await handle_prompt("select a option: ");
};

const main = async () => {

    // check if the data path exist's
    if (!fs.existsSync("./data")) {
        fs.mkdirSync("./data");     
    }

    while (true) {

        console.log("osu-helper 0.6.0 | type exit to... exit?\n");
        
        if (current_option == null) {
            current_option = await select_option();
        }

        current_option = Number(current_option);

        if (current_option > menu_options.length || isNaN(current_option)) {
            console.log("invalid option");
            current_option = null;
            continue;
        }

        await menu_options[current_option].func();

        current_option = null;
    }
};

main();