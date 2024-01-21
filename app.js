import fs from "fs";
import path from "path";

import { OsuReader } from "./thing/reader.js";

/*  buffer parameter is optional, you can specify later on cmd.
    const osu_file = fs.readFileSync(path.resolve("osu_path", "osu!.db"));
    const buffer = Buffer.from(osu_file) 
*/

const Reader = new OsuReader(/* buffer */);
const data = await Reader.export_data();

if (!data) {
    console.log("Something went wrong");
    process.exit(1);
}

// write data to json file
if (fs.existsSync("./data.json")) {
    fs.writeFileSync("data.json", JSON.stringify({ ...data, type: Reader.type }, null, 2));
} else {
    fs.appendFileSync("data.json", JSON.stringify({ ...data, type: Reader.type }, null, 2));
}