import fs from "fs";
import path from "path";
import axios from "axios";
import fetch from "node-fetch"
import pkg from 'bluebird';

import { OsuReader } from "../reader/reader.js";
import { config } from "../other/config.js";
import { login } from "../thing.js";
import { check_path, handle_prompt } from "../other/utils.js";

check_path();

const { Promise } = pkg;

const reader = new OsuReader();
const osu_path = config.get("osu_path");
const osu_file = fs.readFileSync(path.resolve(osu_path, "osu!.db"));
const collection_file = fs.readFileSync(path.resolve(osu_path, "collection.db"));

let missing_maps = [];
let invalid = [];
let current_index = 0;

const invalid_maps = [];

const options = [
    {
        name: "download"
    },
    {
        name: "export beatmaps to a json file"
    }
];

const base_url = "https://api.osu.direct/";

export const search_map_id = async (hash) => {

    try {

        const base = "https://osu.ppy.sh/api/v2/beatmaps/lookup?"
        const response = await axios.get(`${base}checksum=${hash}`, {
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Bearer ${login.access_token}`
            }
        });

        const data = await response.data;

        return data;
    } catch(err) {
        if (err.response) {
            return false; 
        }
        return false;
    }
};

const download_map = async (b) => {

    const response = await fetch(`${base_url}d/${b}`, { method: "GET" });
    const Path = path.resolve("./data/", `${b}.osz`);
    const buffer = await response.arrayBuffer();
    
    if (response.status != 200) {
        throw Error("Map not found");
    }

    fs.writeFileSync(Path, Buffer.from(buffer));
};

const progress_bar = (start_, end) => {

    let sp = " "; 
    let bar = "█"; 

    const start = current_index;

    let perc = Math.floor(start / end * 100); 
    let bars = Math.floor(perc / 10); 

    if (bars < 0) {
        bars = 0;
    }

    process.stdout.clearLine(); 
    process.stdout.cursorTo(0); 

    process.stdout.write(`progress: [${bar.repeat(bars)}${sp.repeat(10 - bars)}] ${end - start} maps remaining`);
}

const download_maps = async (map, index, length) => {

    const hash = map.hash;
    
    try {

        progress_bar(index, length);

        if (!map.id) {
            
            const id = (await search_map_id(hash)).beatmapset_id;
            if (!id) {
                invalid_maps.push({ hash: map.hash });
                current_index++;
                return;
            }

            map.id = id;
        }

        await download_map(map.id);
           
    } catch(error) {;
        invalid_maps.push({ hash: map.hash });
        console.log(error);
        if (error.data) {
            console.log(error.data.message);
        }
    }

    current_index++;
};

const download_things = async () => {
    
    if (handle_prompt("download from a specific collection? (y/n): ") == "y") {

        const collections = [...new Set(missing_maps.map(a => a.collection_name))];

        // print all collections name
        console.log("collections:", collections.join("\n"));

        const name = handle_prompt("collection name: ");

        missing_maps = missing_maps.filter((a) => { return a.collection_name == name })
        if (!missing_maps) {
            console.log("collection not found.");
            return;
        }
        
        console.log("Found:", missing_maps.length, "maps");
    }

    await Promise.map(missing_maps, download_maps, { concurrency: 3 });

    console.log(`\ndone!`);

    if (invalid_maps.length > 0) {
        console.log(`\nfailed to download ${invalid_maps.length} maps.\nreason: outdated/invalid map.\n`);
    }
};

const export_shit = async () => {

    if (handle_prompt("export from a specific collection? (y/n): ") == "y") {

        const collections = [...new Set(missing_maps.map(a => a.collection_name))];

        // print all collections name
        console.log("collections:", collections.join("\n"));

        const name = handle_prompt("collection name: ");
        missing_maps = missing_maps.filter((a) => { return a.collection_name == name })

        if (!missing_maps) {
            console.log("collection not found.");
            return;
        }
        
        console.log("Found:", missing_maps.length, "maps");
    }

    console.log("searching beatmap id's... ( this might take a while )");

    const ids = [];

    await new Promise(async (re) => {

        for (let i = 0; i < missing_maps.length; i++) {

            try {
                
                const map = missing_maps[i];
                const hash = map.hash;
                const info = await search_map_id(hash);   
                
                if (info.beatmapset_id) {
                    ids.push(`https://osu.ppy.sh/beatmapsets/${info.beatmapset_id}`);
                }
    
            } catch(err) {
                invalid.push({ hash: map.hash });
                throw err;
            }    
        }

        re();
    });

    // remove duplicate maps.
    const o = [...new Set(ids)];

    fs.writeFileSync("./data/beatmaps.json", JSON.stringify(o, null , 4));

    console.log("beatmaps.json has been saved in the data folder");
};

export const get_beatmaps_collector = async () => {

    console.clear();

    // get collection maps
    const url = handle_prompt("url: ");

    // get collection id
    const url_array = url.split("/");
    const collection_id = url_array[url_array.length - 2];

    //console.log(collection_id);

    // request collection data from osuCollector api
    const collection_url = `https://osucollector.com/api/collections/${collection_id}`;
    const collection = await axios.get(collection_url);

    if (collection.status != 200) {
        return console.log("\ncollection not found");
    }

    const data = await collection.data;

    // create a new array like missing_maps
    const maps = data.beatmapsets.map((b) => { return { id: b.id } });

    console.log(`Found ${maps.length} maps\ndownloading...`);

    await Promise.map(maps, download_maps, { concurrency: 3 });

    console.log(`\ndone!`);

    if (invalid_maps.length > 0) {
        console.log(`\nfailed to download ${invalid_maps.length} maps.\nreason: outdated/invalid map.\n`);
    }

    const create_new_collection = handle_prompt("add the collection to osu? (y or n): ");
    if (create_new_collection != "y") {
        return;
    }

    reader.set_type("collection");
    reader.set_buffer(collection_file);

    if (reader.collections.length == 0) {
        await reader.get_collections_data();
    }

    const hashes = data.beatmapsets.flatMap((beatmapset) => {
        return beatmapset.beatmaps.map((beatmap) => beatmap.checksum);
    });

    reader.collections.beatmaps.push({
        name: "!helper - " + data.name,
        maps: hashes
    });

    reader.collections.length++;

    const buffer = await reader.write_collections_data();

    fs.writeFileSync("./data/collection.db", Buffer.from(buffer));

    console.log("a new collection file has been created! ( in the data folder )\ncopy the file and paste into the osu! folder ( make sure to backup the old one )")
}

export const missing_initialize = async () => {

    // check if data folder exists
    if (!fs.existsSync("./data/")) {
        fs.mkdirSync("./data/");
    }
    
    // initialize for reading osu!.db
    reader.set_type("osu");
    reader.set_directory(osu_path);
    reader.set_buffer(osu_file);

    await reader.get_osu_data();

    // only the hash/id will be used
    reader.osu.beatmaps.map((b, i) => {
        reader.osu.beatmaps[i] = { hash: b.md5, id: b.beatmap_id };
    });

    // initialize for reading collection.db
    reader.set_type("collection");
    reader.set_buffer(collection_file);

    if (reader.collections.length == 0) {
        await reader.get_collections_data();
    }
    
    const hashes = new Set(reader.osu.beatmaps.map(b => b.hash));
    const Maps = reader.collections.beatmaps.map((b) => { return { name: b.name, maps: b.maps } });

    // verify things
    for (const map of Maps) {

        missing_maps.push({ name: map.name });

        for (const m of map.maps) {
            if (!hashes.has(m)) {
                if (m != "4294967295") {
                    missing_maps.push({ collection_name: map.name, hash: m });
                }
                else {
                    invalid.push({ hash: m });
                }
            }
        }
    }

    console.clear();
    console.log(`found ${missing_maps.length} missing maps\n${invalid.length} are unknown maps.`);

    for (let i = 0; i < options.length; i++) [
        console.log(`[${i}] - ${options[i].name}`)
    ]

    const option = handle_prompt("select a option: ");
    if (option == "exit") {
        process.exit(0);
    }

    if (Number(option) > options.length) {
        return;
    }

    if (Number(option) == 0) {
        await download_things();
        return;
    }

    await export_shit();
    return;
};