import fs from "fs";
import * as dotenv from "dotenv";
import path from "path";
import axios from "axios";
import PromptSync from "prompt-sync";

import { OsuReader } from "../reader/reader.js";
import { auth } from 'osu-api-extended';

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
await auth.login(process.env.OSU_ID, process.env.OSU_SECRET, ['public']);

const reader = new OsuReader();
const prompt = PromptSync();

// initialize for reading osu!.db
const osu_path = path.resolve("E:\\osu!");
const osu_file = fs.readFileSync(path.resolve(osu_path, "osu!.db"));
const collection_file = fs.readFileSync(path.resolve(osu_path, "collection.db"));

reader.set_type("osu");
reader.set_directory("E:\\osu!");
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

const missing_maps = [], invalid = [];
const hashes = new Set(reader.osu.beatmaps.map(b => b.hash));

reader.collections.beatmaps.forEach((b, i) => {

    console.log("searching collection:", i);

    b.maps.forEach((hash, i) => {
        if (!hashes.has(hash) && !missing_maps.includes(hash)) {
            if (reader.osu.beatmaps[i].id != "4294967295") {
                missing_maps.push({ hash, id: reader.osu.beatmaps[i].id });
            }
            else {
                invalid.push({ hash, id: reader.osu.beatmaps[i].id });
            }
        }
    });
});

const download_map = async (b) => {

    console.log("downloading map:", count + 1);

    try {
        const response = await axios.get(`${base_url}${b.id}`, {
            responseType: "stream",
            method: "GET",
        });

        const stream = fs.createWriteStream(path.resolve("./data/", `${b.id}.osz`));
        response.data.pipe(stream);

        await new Promise((resolve, reject) => {
            stream.on("finish", resolve);
            stream.on("error", (err) => {
                console.error("error:", b.id, err);
                reject(err);
            });
        });

        count++;

    } catch (error) {
        if (error.response) {
            console.error("api error:", error.code);
        }
        else {
            console.log("yep that was an error...");
        }
    }
};

const download_maps = async () => {
    for (const map of missing_maps) {
        await download_map(map);
    }
};

const base_url = "https://api.chimu.moe/v1/download/";
let count = 0;

console.log(`found ${missing_maps.length} missing maps\n${invalid.length} invalid maps.`);

console.log(missing_maps.slice(0, 10));

const question = prompt("download missing maps? (y/n): ");

if (question != "y") {
    process.exit(0);
}

if (prompt("download from a specific collection? (y/n): ") == "y") {

    const name = prompt("collection name: ");
    missing_maps = missing_maps[name];

    if (!missing_maps) {
        console.log("collection not found.");
        process.exit(0);
    }
} 

download_maps().then(() => {
    console.log("done");
}).catch(() => {
    console.log("something went wrong... probably with the api to download maps idk.")
});