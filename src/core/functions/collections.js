import fs from "fs";
import path from "path";

import { OsuReader } from "../reader/reader.js";
import { config } from "../../other/config.js";
import { search_map_id } from "./missing_maps.js";
import { check_path, handle_prompt } from "../../other/utils.js";

check_path();

const reader = new OsuReader();

reader.set_directory(path.resolve(config.get("osu_path")));

const get_collections = async () => {
    
    const collections_buffer = fs.readFileSync(path.resolve(config.get("osu_path"), "collection.db"));
    reader.set_buffer(Buffer.from(collections_buffer));

    await reader.get_collections_data();
};

const get_osu = async () => {
    
    const buffer = fs.readFileSync(path.resolve(config.get("osu_path"), "osu!.db"));
    reader.set_buffer(Buffer.from(buffer));

    await reader.get_osu_data();
};

export const get_invalid_maps = async () => {

    console.log("\ncollecting maps and filtering invalid ones...\n");
    
    // initialize variables
    await get_collections();
    await get_osu();

    const hashes = new Set(reader.osu.beatmaps.map(b => b.md5));
    const collections = reader.collections.beatmaps.map((b) => { return { name: b.name, maps: b.maps } });

    const invalid_shit = [];

    for (let i = 0; i < collections.length; i++) {
        const collection = collections[i];

        for (let k = 0; k < collection.maps.length; k++) {
            const map = collection.maps[k];

            if (!hashes.has(map)) {
                invalid_shit.push(map);
            }
        }
    }

    reader.osu = null;

    console.log("checking invalid maps...\n");

    const valid = [];

    for (const hash in invalid_shit) {
        const map = await search_map_id(hash);

        if (map) {
            valid.push(hash);
        }
    }

    const mappers = invalid_shit.length - valid.length;
    if (!mappers) {
        console.log("it seems there's no invalid maps in your collections :3\n");
        return;
    }

    console.log(`${mappers} maps has been found...\n`);

    if (handle_prompt("do you want to remove them? (y/n) ") != "y") {
        console.log("ok");
        return;
    } 

    const filtered = invalid_shit.filter(value => !valid.includes(value));
    for (let i = 0; i < reader.collections.beatmaps.length; i++) {
        reader.collections.beatmaps[i].maps = reader.collections.beatmaps[i].maps.filter(map => !filtered.includes(map));
    }

    const buffer = await reader.write_collections_data();

    fs.writeFileSync("../data/collection.db", Buffer.from(buffer));

    console.log("\na new collection.db file has been generated. make sure to backup the old one before replacing in osu folder\n");
};