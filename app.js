import fs from "fs";
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

// create data folder
if (!fs.existsSync("./data")) {
    fs.mkdirSync("./data");
}

// write data to json file
if (fs.existsSync("./data/info.json")) {
    fs.writeFileSync("./data/info.json", JSON.stringify({ ...data, type: Reader.type }, null, 2));
} else {
    fs.appendFileSync("./data/info.json", JSON.stringify({ ...data, type: Reader.type }, null, 2));
}