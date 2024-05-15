import fs from "fs";
import path from "path";
import axios from "axios";
import pMap from 'p-map';

import { OsuReader } from "../reader/reader.js";
import { config } from "../config.js";
import { login } from "../index.js";
import { check_path, handle_prompt, show_menu, mirrors, search_mirrors } from "../../other/utils.js";
import { filter } from "./filter.js";

check_path();

const invalid_maps = [];
const reader = new OsuReader();
const osu_path = config.get("osu_path");
const osu_file = fs.readFileSync(path.resolve(osu_path, "osu!.db"));
const collection_file = fs.readFileSync(path.resolve(osu_path, "collection.db"));

let missing_maps = [];
let invalid = [];
let last_log = "";
let pirocas = ["|", "/", "-", "\\"];
let current_piroca = 0;
let is_collection = false;

export const search_map_id = async (hash) => {

    try {

        const response = await fetch(`https://osu.ppy.sh/api/v2/beatmaps/lookup?checksum=${hash}`, {
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Bearer ${login.access_token}`
            }
        });

        const data = await response.json();

        if (!data) {
            return null;
        }
        
        data.id = data.beatmapset_id;

        return data;

    } catch(err) {
        return null;
    }
};

export const get_beatmap = async (url, data) => {

    try {

        const cu = Object.keys(filter);

        for (let i = 0; i < cu.length; i++) {

            const name = cu.at(i);
            const f = filter[name];
                
            if (name == "star" && f.enabled) {

                // for some reason sometimes the osu api return some random ass beatmap that have like 8 start but if you try to download this shit it will appear as a 2 star.. so idk fuck peppy

                if (!data.difficulty_rating) {

                    if (!data.checksum) {
                        last_log = "checksum not found";
                        return null;
                    }

                    const response = await search_map_id(data.checksum);

                    if (response == null) {
                        last_log = "failed to search beatmap info " + data.id || data.checksum;
                        return null;
                    }

                    data.difficulty_rating = response.difficulty_rating;
                }

                if (f.min && data.difficulty_rating < f.min) {
                    last_log = `failed to download beatmap ${data.id} (SR Filter) ${data.difficulty_rating}`;
                    return;
                }

                if (f.max && data.difficulty_rating > f.max) {
                    last_log = `failed to download beatmap ${data.id} (SR Filter) ${data.difficulty_rating}`;
                    return;
                }
            }

            if (name == "status" && f.enabled) {

                if (!data.status) {

                    if (!data.checksum) {
                        last_log = "checksum not found";
                        return null;
                    }

                    const response = await search_map_id(data.checksum);

                    if (response == null) {
                        last_log = "failed to search beatmap info " + data.id || data.checksum;
                        return null;
                    }

                    data.status = response.status;
                }

                if (f.mode == 0) {

                    if (data.status != f.value) {
                        last_log = `failed to download beatmap ${data.id} (STATUS Filter)`;
                        return;
                    }

                } else {

                    if (data.status == f.value) {
                        last_log = `failed to download beatmap ${data.id} (STATUS Filter)`;
                        return;
                    }

                }  
            }
        }

        if (data.id == "2026708") {
            console.log(data);
            process.exit(1);
        }

        const response = await fetch(`${url}${data.id}`, { method: "GET", headers: { responseType: "arraybuffer" } });

        if (response.status != 200) {
            last_log = `failed to download: ${data.id}`;
            return null;
        }

        const bmdata = await response.arrayBuffer();
        const buffer = Buffer.from(bmdata);
        
        if (!buffer) {
            return null;
        }

        return buffer;

    } catch(err) {
        last_log = `failed to download: ${id}`;
        return null;
    }
};

export const find_map = async (mirror, id) => {
    
    const is_list = mirror.length ? true : false;
    const buffer = [];

    // search using the mirror url
    if (!is_list) {
        
        const buffer = await get_beatmap(mirror, id);
        
        if (buffer == null) {
            return null;
        }

        return buffer;
    }
    
    // look through the beatmaps mirrors
    for (let i = 0; i < mirrors.length; i++) {

        const mirror = mirrors[i];

        if (!mirror.url || !id) {
            return null;
        }

        const map_buffer = await get_beatmap(mirror.url, id);

        if (map_buffer == null) {
            continue;
        }

        buffer.push(map_buffer);
        break;
    }

    return buffer.length == 0 ? null : buffer[0];
};

Number.prototype.clamp = function(min, max) {
    return Math.min(Math.max(this, min), max);
};

export const progress_bar = (start, end) => {

    let sp = " "; 
    let bar = "█"; 

    current_piroca++;
    if (current_piroca > pirocas.length - 1) {
        current_piroca = 0;
    }

    let perc = Math.floor(start / end * 100).clamp(0, 100);
    let bars = Math.floor(perc / 10).clamp(0, 10); 

    let lines = last_log ? 3 : 1;

    for (let i = 0; i < lines - 1; i++) {
        process.stdout.moveCursor(0, -1);
        process.stdout.clearLine(0);
    }
    
    if (last_log !== '') {
        process.stdout.cursorTo(0);
        process.stdout.write(`\nLOG -> ${last_log}\n`);
    }
 
    process.stdout.cursorTo(0);
    process.stdout.write(`downloading: [${bar.repeat(bars)}${sp.repeat((10 - bars).clamp(0, 10))}] ${perc}% ${pirocas[current_piroca]}`);
}

const download_maps = async (map, index) => {

    progress_bar(index, missing_maps.length);

    if (!map.id) {
        
        if (!map.hash) {
            last_log = "invalid map " + map.id;
            return;
        }

        const beatmap = await search_map_id(map.hash);

        if (beatmap == null) {
            invalid_maps.push({ hash: map.hash });
            last_log = "Failed to find beatmap hash: " + (map.hash || "") + " " + map;
            return;
        }

        if (!beatmap.beatmapset_id) {
            return;
        }

        const c_checksum = map.hash;

        map = { checksum: c_checksum, id: beatmap.beatmapset_id, ...beatmap };
    }

    const Path = path.resolve(config.get("osu_songs_folder"), `${map.id}.osz`);

    if (fs.existsSync(Path)) {
        last_log = `beatmap: ${map.id} already exists in your songs folder`;
        return;
    }

    const osz_buffer = Object.keys(map).length > 1 ? await find_map(mirrors, map) : await find_map(mirrors, map.id);

    if (osz_buffer == null) {
        return;
    }

    // TO FIX: Error: EBUSY: resource busy or locked
    try {
        fs.writeFileSync(Path, Buffer.from(osz_buffer));
        last_log = `saved beatmap ${map.id}`;
    }
    catch(err) {
        //
    }
};

const download_things = async () => {
    
    if (await handle_prompt("download from a specific collection? (y/n): ") == "y") {

        const collections = [...new Set(missing_maps.map(a => a.collection_name))];
        const obj = [];

        for (let i = 0; i < collections.length; i++) {
            if (collections[i]) {
                obj.push({ name: collections[i] });
            }
        }

        const selected_index = await show_menu(obj);
        const abc = missing_maps;
        const name = obj[selected_index].name;

        missing_maps = [];

        for (let i = 0; i < abc.length; i++) {
            
            if (abc[i].collection_name != name || !abc[i].hash) {
                continue;
            }

            missing_maps.push(abc[i]);
        }

        if (!missing_maps) {
            console.log("collection not found.");
            return;
        }
        
        console.log("Found:", missing_maps.length, "maps");
    }

    console.clear();

    await pMap(missing_maps, download_maps, { concurrency: 5 });
    
    console.clear();

    console.log(`\ndone!`);

    if (invalid_maps.length > 0) {
        console.log(`\nfailed to download ${invalid_maps.length} maps.\nreason: outdated/invalid map.\n`);
    }
};

const export_shit = async () => {

    const ids = [];

    if (await handle_prompt("export from a specific collection? (y/n): ") == "y") {

        const collections = [...new Set(missing_maps.map(a => a.collection_name))];
        const obj = [];

        for (let i = 0; i < collections.length; i++) {
            if (collections[i]) {
                obj.push({ name: collections[i] });
            }
        }

        const selected_index = await show_menu(obj);
        const name = obj[selected_index].name;

        missing_maps = missing_maps.filter((a) => { return a.collection_name == name })

        if (!missing_maps) {
            console.log("collection not found.");
            return;
        }
        
        console.log("Found:", missing_maps.length, "maps");
    }

    console.log("\nsearching beatmap id's... ( this might take a while )");

    await new Promise(async (re) => {

        for (let i = 0; i < missing_maps.length; i++) {

            const map = missing_maps[i];     
            const hash = map.hash;
            const info = await search_map_id(hash);   

            if (info == null) {
                invalid.push({ hash: map.hash });
                continue;
            }
            
            if (info.beatmapset_id) {
                ids.push(`https://osu.ppy.sh/beatmapsets/${info.beatmapset_id}`);
            }
        }

        re();
    });

    // remove duplicate maps.
    const o = [...new Set(ids)];

    fs.writeFileSync(path.resolve("./data/beatmaps.json"), JSON.stringify(o, null , 4));

    console.log("\na file named beatmaps.json has been created in the data folder!\n");
};

const get_tournament_maps = async(id) => {
    const response = await fetch(`https://osucollector.com/api/tournaments/${id}`);

    const data = await response.json();

    const maps = [];
    const collection = {};
    const rounds = data.rounds;

    for (let i = 0; i < rounds.length; i++) {
        const round = rounds[i].mods;
        for (let k = 0; k < round.length; k++) {
            const mods = round[k].maps;
            maps.push(...mods);
        }
    }

    collection.name = data.name;
    collection.status = response.status;
    collection.beatmapsets = maps;

    return collection;
};

const options = [
    {
        name: "download",
        callback: download_things
    },
    {
        name: "export beatmaps to a json file",
        callback: export_shit
    }
];


export const download_all_maps_from_osu = async () => {

    /* 
        Use this if for some unknown reason you lost you osu Songs folder but you still have the osu.db file.
        To enable this option just uncomment the object named: "FUCK" from the index.js file.
        I recommend to use this 2/3 times, sometimes the api just goes crazy or you just reached the limit so after you downloaded the first time wait some minutes and do it again before opening osu!.
    */

    const ids = [];

    reader.set_type("osu");
    reader.set_buffer(osu_file, true);

    if (!reader.osu.beatmaps) {

        console.log("reading osu.db file...\n");

        await reader.get_osu_data();
        
        for (let i = 0; i < reader.osu.beatmaps.length; i++) {

            if (reader.osu.beatmaps[i].beatmap_id) {
                ids.push({id: reader.osu.beatmaps[i].beatmap_id});
            }
        }
    }

    console.log("Diffs length:", ids.length);

    const hp = [];
    missing_maps = ids.filter((e,i) => {
        if (hp.includes(e.id)) {
            return false;
        } else {
            hp.push(e.id)
            return true;
        }
    });

    console.log("Maps length:", missing_maps.length);

    await handle_prompt("PRESS ENTER");

    await pMap(missing_maps, download_maps, { concurrency: 5 }); 
};

export const get_beatmaps_collector = async () => {

    if (!login) {
        console.log("\nPlease restart the script to use this feature\n");
        return;
    }

    console.clear();

    // get collection maps
    const url = await handle_prompt("url: ", true);

    // get collection id
    const url_array = url.split("/");
    const collection_id = url_array[url_array.length - 2];

    if (!collection_id) {
        console.log("\nInvalid URL\n");
        return;
    }

    // request collection data from osuCollector api
    const is_tournament = url_array.includes("tournaments");
    const collection_url = `https://osucollector.com/api/collections/${collection_id}`;
    const Rcollection = is_tournament ? await get_tournament_maps(collection_id) : await axios.get(collection_url);
    const collection = is_tournament ? Rcollection : Rcollection.data;
    
    if (Rcollection.status != 200) {
        return console.log("\ncollection not found");
    }

    if (!collection.beatmapsets) {
        console.log("\nFailed to get collection from osu collector\n");
        return;
    }

    reader.set_type("osu");
    reader.set_buffer(osu_file, true);

    if (!reader.osu.beatmaps) {
        console.log("reading osu.db file...\n");
        await reader.get_osu_data();
    }

    // TODO: make this more readable and less stupid.
    // get maps that are currently missing
    const maps_hashes = new Set(reader.osu.beatmaps.map((beatmap) => beatmap.md5));
    const collection_hashes = is_tournament ? 
    [...new Set(
        collection.beatmapsets.map((b) => b.checksum)
    )]
    : // else
    [...new Set(
        collection.beatmapsets.flatMap(
          (b) => b.beatmaps.map((b) => b.checksum)
        )
    )];
    
    const filtered_maps = is_tournament ?
    collection.beatmapsets.filter((beatmap) => {
        return !maps_hashes.has(beatmap.checksum) && beatmap.checksum && beatmap.beatmapset;
    }).map((b) => b.beatmapset)
    : // else
    collection.beatmapsets.filter((beatmapset) => {
        return !beatmapset.beatmaps.some((beatmap) => maps_hashes.has(beatmap.checksum));
    }).flatMap((beatmapset) => { // this might cause issues but btw. maybe i will change this later
        return beatmapset.beatmaps.map(() => ({
          id: beatmapset.id,
          checksum: beatmapset.beatmaps[0].checksum,
        }));
    });

    console.log(`Found ${filtered_maps.length} missing maps`);

    // fs.writeFileSync("data.json", JSON.stringify(filtered_maps, null, 4));
    // process.exit(1);

    const confirmation = await handle_prompt("download? (y or n): ");
    if (confirmation == "y") {

        missing_maps = filtered_maps;
        is_collection = true;

        await pMap(missing_maps, download_maps, { concurrency: 5 }); 

        is_collection = false;
    
        // clean progress bar line
        process.stdout.clearLine(); 
        process.stdout.cursorTo(0); 
    
        console.log(`\ndone!`);

        if (invalid_maps.length > 0) {
            console.log(`\nfailed to download ${invalid_maps.length} maps.\nreason: outdated/invalid map.\n`);
        }
    }

    const create_new_collection = await handle_prompt("add collection to osu? (y or n): ");
    if (create_new_collection != "y") {
        return;
    }

    reader.set_type("collection");
    reader.set_buffer(collection_file, true);

    if (reader.collections.length == 0) {
        await reader.get_collections_data();
    }

    reader.collections.beatmaps.push({
        name: "!helper - " + collection.name,
        maps: collection_hashes
    });

    reader.collections.length++;

    const buffer = await reader.write_collections_data();
    const backup_name = `collection_backup_${Date.now()}.db`;

    // backup 
    fs.renameSync(path.resolve(config.get("osu_path"), "collection.db"), path.resolve(config.get("osu_path"), backup_name));
    // write the new one
    fs.writeFileSync(path.resolve(config.get("osu_path"), "collection.db"), Buffer.from(buffer));

    console.clear();

    console.log("\nYour collection file has been updated!\nA backup file named", backup_name, "has been created in your osu directory\nrename it to collection.db in case the new one is corrupted\n");
}

export const missing_initialize = async () => {

    console.clear();

    // check if data folder exists
    if (!fs.existsSync("./data/")) {
        fs.mkdirSync("./data/");
    }
    
    // initialize for reading osu!.db
    reader.set_type("osu");
    reader.set_directory(osu_path);
    reader.set_buffer(osu_file, true);

    await reader.get_osu_data();

    // only the hash/id will be used
    reader.osu.beatmaps.map((b, i) => {
        reader.osu.beatmaps[i] = { hash: b.md5, id: b.beatmap_id };
    });

    // initialize for reading collection.db
    reader.set_type("collection");
    reader.set_buffer(collection_file, true);

    if (reader.collections.length == 0) {
        await reader.get_collections_data();
    }
    
    const hashes = new Set(reader.osu.beatmaps.map(b => b.hash));
    const Maps = reader.collections.beatmaps.map((b) => { return { name: b.name, maps: b.maps } });

    // verify things
    for (const map of Maps) {

        for (const m of map.maps) {
            
            if (!m) {
                continue;
            }

            if (hashes.has(m)) {
                continue;
            }

            if (m != "4294967295") {
                missing_maps.push({ collection_name: map.name, hash: m });
            }

        }
    }

    console.clear();

    console.log(`found ${missing_maps.length} missing maps\n${invalid.length} are unknown maps.`);

    await show_menu(options);

    if (!login) {
        console.log("\nPlease restart the script to use this feature\n");
        return;
    }

    return;
};