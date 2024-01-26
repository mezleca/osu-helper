import fs from "fs";
import path from "path";
import axios from "axios";
import PromptSync from "prompt-sync";

import { OsuReader } from "../reader/reader.js";
import { auth, tools, download } from 'osu-api-extended';
import { config } from "../config.js";

// login :3
const login = await auth.login(config.osu_id, config.osu_secret, ['public']);

const reader = new OsuReader();
const prompt = PromptSync();

const osu_path = path.resolve("E:\\osu!");
const osu_file = fs.readFileSync(path.resolve(osu_path, "osu!.db"));
const collection_file = fs.readFileSync(path.resolve(osu_path, "collection.db"));

let count = 0;
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

const search_map_id = async (hash) => {

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
        console.log(err.response.status);
        return false;
    }
};

const base_url = "https://api.chimu.moe/v1/download/";

const download_map = async (b) => {

    console.log("downloading map:", count + 1);

    try {
        const response = await axios.get(`${base_url}${b}`, {
            responseType: "stream",
            method: "GET",
        });

        const stream = fs.createWriteStream(path.resolve("./data/", `${b}.osz`));
        response.data.pipe(stream);

        await new Promise((resolve, reject) => {
            stream.on("finish", resolve);
            stream.on("error", (err) => {
                console.error("error:", b, err);
                reject(err);
            });
        });
    } catch (error) {
        if (error.response) {
            console.error("api error:", error.response, b);
        }
        else {
            console.log("yep that was an error...");
        }
    }

    count++;
};

const download_maps = async () => {
    
    invalid = [];

    for (const map of missing_maps) {

        try {

            const hash = map.hash;
            const id = (await search_map_id(hash)).beatmapset_id;

            if (!id) {
                invalid.push({ hash: map.hash });
            }
            else {
                await download_map(id);
            }

        } catch(error) {;
            console.log(error.response)
            invalid.push({ hash: map.hash });
        }    
    }

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
                
                if (info) {
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
};

export const missing_initialize = async () => {

    // check if data folder exists
    if (!fs.existsSync("./data/")) {
        fs.mkdirSync("./data/");
    }
    
    // initialize for reading osu!.db
    reader.set_type("osu");
    reader.set_directory(config.osu_path);
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