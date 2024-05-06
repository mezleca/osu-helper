import os from "os";
import fs from "fs";

import path from "path";

import { handle_prompt } from "../other/utils.js";

// TODO: test this on linux

let file_is_invalid = false;

const linux_path = os.homedir() + "/.config/osu_helper";
const windows_path = os.homedir() + "/Documents";
const config_path = path.resolve(os.type() == "Windows_NT" ? windows_path : linux_path);
const file_path = path.resolve(config_path, "config.json");

const default_config = {
    osu_id: "",
    osu_secret: "",
    osu_path: "",
    osu_songs_folder: ""
};

if (!fs.existsSync(config_path)) {
    fs.mkdir(config_path);
}

const config_obj  = fs.existsSync(file_path) ? JSON.parse(fs.readFileSync(file_path)) : default_config, 
      valid_items = ["osu_id", "osu_secret", "osu_path", "osu_songs_folder"];

for (const item in config_obj) {

    if (config_obj[item] != "" || !valid_items.includes(item)) {
        continue;
    }

    console.log("config for", item, "not found...");

    let value = await handle_prompt(`${item}: `);
    value.replace(/\\/g, '\\\\');

    config_obj[item] = value;
    file_is_invalid = true;
}

if (file_is_invalid) {
    fs.writeFileSync(file_path, JSON.stringify(config_obj, null, 4));
    console.log("config has been saved");
}

export const config = new Map(Object.entries(config_obj));