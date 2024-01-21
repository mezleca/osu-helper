import fs, { read } from "fs";
import { OsuReader } from "../reader/reader.js";

/*  buffer parameter is optional, you can specify later on cmd.
    const osu_file = fs.readFileSync(path.resolve("osu_path", "osu!.db"));
    const buffer = Buffer.from(osu_file) 
*/

const reader = new OsuReader(/* buffer */);
await reader.initialize();

if (!reader.osu && !reader.collections) {
    console.log("Something went wrong");
    process.exit(1);
}

const data = reader.type != "osu" ? reader.collections : reader.osu;

// create data folder
if (!fs.existsSync("./data")) {
    fs.mkdirSync("./data");
}

// modifications test
data.beatmaps[data.beatmaps.length - 1].name = "zzzpenis";
const new_collections_buffer = await reader.write_collections_data();

// write data to db file
if (fs.existsSync("./data/collection.db")) {
    fs.writeFileSync("./data/collection.db", new_collections_buffer);
}
else {
    fs.appendFileSync("./data/collection.db", new_collections_buffer);
}