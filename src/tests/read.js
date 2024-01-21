import fs from "fs";
import path from "path";
import { OsuReader } from "../reader/reader.js";

/*  buffer/type parameter is optional, you can specify later on cmd.
    const osu_file = fs.readFileSync(path.resolve("osu_path", "osu!.db"));
    const buffer = Buffer.from(osu_file) 
*/

const reader = new OsuReader(/* buffer, type */);

// initialize for reading osu!.db
const osu_path = path.resolve("E:\\osu!");
const osu_file = fs.readFileSync(path.resolve(osu_path, "osu!.db"));
const collection_file = fs.readFileSync(path.resolve(osu_path, "collection.db"));

reader.set_type("osu");
reader.set_directory("E:\\osu!");
reader.set_buffer(osu_file);

await reader.get_osu_data();

// initialize for reading collection.db
reader.set_type("collection");
reader.set_buffer(collection_file);

await reader.get_collections_data();

// create data folder
if (!fs.existsSync("./data")) {
    fs.mkdirSync("./data");
}

// delete unnecessary data
reader.osu.beatmaps.map((a, i) => {
    delete reader.osu.beatmaps[i].sr;
    delete reader.osu.beatmaps[i].timing_points;
});

// write to json
fs.writeFileSync("./data/osu.json", JSON.stringify(reader.osu, null, 4));
fs.writeFileSync("./data/collections.json", JSON.stringify(reader.collections, null, 4));