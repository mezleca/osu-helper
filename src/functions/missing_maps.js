import fs from "fs";
import path from "path";
import axios from "axios";
import PromptSync from "prompt-sync";

import { OsuReader } from "../reader/reader.js";
import { auth } from 'osu-api-extended';
import { config } from "../config.js";

// login :3
const login = await auth.login(config.get("osu_id"), config.get("osu_secret"), ['public']);

const reader = new OsuReader();
const prompt = PromptSync();

if (!fs.existsSync(config.get("osu_path")) || !fs.existsSync(config.get("osu_songs_folder"))) {
    console.clear();
    console.log("osu path is invalid!\nplease update your config.js file with the osu / osu songs correct path");
    process.exit(1);
}

const osu_path = config.get("osu_path");
const osu_file = fs.readFileSync(path.resolve(osu_path, "osu!.db"));
const collection_file = fs.readFileSync(path.resolve(osu_path, "collection.db"));

let missing_maps = [];
let invalid = [];

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

    const response = await axios.get(`${base_url}v2/md5/${hash}`);
    const data = await response.data;

    if (response.status == 404) {
        console.log(response.statusText);
        return false;
    }

    return data;
};

const download_map = async (b) => {

    const response = await fetch(`${base_url}d/${b}`, { method: "GET" });
    const Path = path.resolve("./data/", `${b}.osz`);
    const buffer = await response.arrayBuffer();
    
    if (response.status == 404) {
        throw Error("Map not found");
    }

    fs.writeFileSync(Path, Buffer.from(buffer));
};

const download_maps = async () => {
    
    invalid = [];
    let index = 0;

    let sp = " "; // % spaces
    let bar = "█"; // barras

    // TODO: concurrent download ( 4 maps limit )
    for (const map of missing_maps) {

        try {

            let perc = Math.floor(index / missing_maps.length *  100); // %
            let bars = Math.floor(perc / 10); // quantidade de barras

            process.stdout.clearLine(); // limpa a linha atual
            process.stdout.cursorTo(0); // move para o inicio da linha

            process.stdout.write(`[${bar.repeat(bars)}${sp.repeat(10 - bars)}] ${100 - perc}% remaining`);

            const hash = map.hash;
            const id = (await search_map_id(hash)).beatmapset_id;

            if (!id) {
                invalid.push({ hash: map.hash });
            }
            else {
                await download_map(id);
            }

        } catch(error) {;
            invalid.push({ hash: map.hash });
            if (error.data) {
                console.log(error.data.message);
            }
        }

	    index++;
    }

    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(`[${bar.repeat(10)}] 0% remaining`);

    console.log(`\ndone\nfailed to download ${invalid.length} maps.\nreason: outdated/invalid map.\n`);
};

const download_things = async () => {
    
    if (prompt("download from a specific collection? (y/n): ") == "y") {

        const collections = [...new Set(missing_maps.map(a => a.collecton_name))];

        // print all collections name
        console.log("collections:", collections.join("\n"));

        const name = prompt("collection name: ");

        missing_maps = missing_maps.filter((a) => { return a.collecton_name == name })
        if (!missing_maps) {
            console.log("collection not found.");
            return;
        }
        
        console.log("Found:", missing_maps.length, "maps");
    }

    await download_maps();
};

const export_shit = async () => {

    if (prompt("export from a specific collection? (y/n): ") == "y") {

        const collections = [...new Set(missing_maps.map(a => a.collecton_name))];

        // print all collections name
        console.log("collections:", collections.join("\n"));

        const name = prompt("collection name: ");
        missing_maps = missing_maps.filter((a) => { return a.collecton_name == name })

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

export const missing_initialize = async () => {

    // check if data folder exists
    if (!fs.existsSync("./data/")) {
        fs.mkdirSync("./data/");
    }
    
    // initialize for reading osu!.db
    reader.set_type("osu");
    reader.set_directory(config.osu_path);
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

    await reader.get_collections_data();

    const hashes = new Set(reader.osu.beatmaps.map(b => b.hash));
    const Maps = reader.collections.beatmaps.map((b) => { return { name: b.name, maps: b.maps } });

    // verify things
    for (const map of Maps) {

        missing_maps.push({ name: map.name });

        for (const m of map.maps) {
            if (!hashes.has(m)) {
                if (m != "4294967295") {
                    missing_maps.push({ collecton_name: map.name, hash: m });
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

    const option = prompt("select a option: ");
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