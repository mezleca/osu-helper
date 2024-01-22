import fs from "fs";
import * as dotenv from "dotenv";
import path from "path";
import axios from "axios";
import PromptSync from "prompt-sync";

import { OsuReader } from "../reader/reader.js";
import { auth, v2, v1 } from 'osu-api-extended';

/* 
* This script will download all missing maps from your collection.db
* and save them to the data folder.
* For some reason, even after you download all missing maps, osu file will still say that there are missing maps.
* Maybe it's because the beatmap on api has a different hash than the one in your collection.db.
*/

dotenv.config({
    path: "../../.env"
});

// login :3
const login = await auth.login(process.env.OSU_ID, process.env.OSU_SECRET, ['public']);

const reader = new OsuReader();
const prompt = PromptSync();

// initialize for reading osu!.db
const osu_path = path.resolve("E:\\osu!");
const osu_file = fs.readFileSync(path.resolve(osu_path, "osu!.db"));
const collection_file = fs.readFileSync(path.resolve(osu_path, "collection.db"));

reader.set_type("osu");
reader.set_directory("E:\\osu!");
reader.set_buffer(osu_file);

const search_map_id = async (hash) => {

    const base = "https://osu.ppy.sh/api/v2/beatmaps/lookup?"
    const response = await axios.get(`${base}checksum=${hash}`, {
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${login.access_token}`
        }
    })

    const data = await response.data;
    return data.beatmapset_id;
};

await reader.get_osu_data();

// only the hash/id will be used
reader.osu.beatmaps.map((b, i) => {
    reader.osu.beatmaps[i] = { hash: b.md5, id: b.beatmap_id };
});

// initialize for reading collection.db
reader.set_type("collection");
reader.set_buffer(collection_file);

await reader.get_collections_data();

let missing_maps = [], invalid = [];
const hashes = new Set(reader.osu.beatmaps.map(b => b.hash));

const Maps = reader.collections.beatmaps.map((b) => { return { name: b.name, maps: b.maps } });

for (const map of Maps) {
    for (const m of map.maps) {
        if (!hashes.has(m)) {
            if (m != "4294967295") {
                missing_maps.push({ hash: m });
            }
            else {
                invalid.push({ hash: m });
            }
        }
    }
}

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
            console.error("api error:", error.response.status, error.response.statusText);
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
            const id = await search_map_id(hash);

            await download_map(id);
        } catch(err) {
            invalid.push({ hash: map.hash });
        }    
    }

    console.log(`done\nfailed to download ${invalid.length}. reason: outdated/invalid map.}`);
};

const base_url = "https://api.chimu.moe/v1/download/";
let count = 0;

console.log(`found ${missing_maps.length} missing maps\n${invalid.length} are unknown maps.`);

const question = prompt("download missing maps? (y/n): ");

if (question != "y") {
    process.exit(0);
}


// TODO
// if (prompt("download from a specific collection? (y/n): ") == "y") {

//     const name = prompt("collection name: ");
//     missing_maps = missing_maps[name];

//     if (!missing_maps) {
//         console.log("collection not found.");
//         process.exit(0);
//     }
// } 

download_maps().then(() => {
    console.log("done");
}).catch((err) => {
    console.log("something went wrong... probably with the api to download maps idk.", err)
});