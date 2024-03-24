import { missing_initialize, get_beatmaps_collector } from "./functions/missing_maps.js";
import { download_initialize } from "./functions/download_maps.js";
import { get_invalid_maps } from "./functions/collections.js";
import { check_login, handle_prompt } from "./other/utils.js";

// login :3
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

const select_option = () => {

    for (let i = 0; i < menu_options.length; i++) {
        console.log(`[${i}] - ${menu_options[i].name}`);
    }

    console.log("\n");

    return handle_prompt("select a option: ");
};

const main = async () => {
    
    while (true) {

        console.log("osu-thing 0.4 | type exit to... exit?\n");
        
        if (current_option == null) {
            current_option = select_option();
        }

        current_option = Number(current_option);

        if (current_option > menu_options.length || isNaN(current_option)) {
            console.log("invalid option");
            current_option = null;
            return;
        }

        await menu_options[current_option].func();

        current_option = null;
    }
};

main();