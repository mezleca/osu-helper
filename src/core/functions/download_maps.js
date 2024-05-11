import fs from "fs";
import path from "path";

import { handle_prompt, mirrors } from "../../other/utils.js";
import { find_map, progress_bar } from "./missing_maps.js";
import { config } from "../config.js";

export const download_initialize = async () => {

    console.clear();

    console.log("\nWARN: make sure your input file is a json and have this format\n-> ['https://osu.ppy.sh/beatmapsets/id_here', ...]\n");

    let file_path = await handle_prompt("enter the file path: ");
    const format = file_path.split(".");

    if (format[format.length - 1] != "json") {

        const all_files = fs.readdirSync(file_path);
        const maybe_a_valid_one = all_files.find((v) => v.split(".").includes("json"));

        if (!maybe_a_valid_one) {
            return;
        } 

        file_path = path.resolve(file_path, maybe_a_valid_one);
    }

    // verify if the file exists
    if (!fs.existsSync(path.resolve(file_path))) {
        console.log("\nfile not found\n");
        return;
    }

    const file = fs.readFileSync(path.resolve(file_path), "utf-8");
    const json = JSON.parse(file);

    console.log("downloading", json.length, "maps...\n");

    for (let i = 0; i < json.length; i++) {

        progress_bar(i, json.length);

        const a = json[i].split("/");
        const id = a[a.length - 1];

        const osz_buffer = await find_map(mirrors, id);

        if (osz_buffer == null) {
            continue;
        } 

        fs.writeFileSync(path.resolve(config.get("osu_songs_folder"), `${id}.osz`), Buffer.from(osz_buffer));
    }

    console.clear();
    console.log("\ndone!\n");
};
