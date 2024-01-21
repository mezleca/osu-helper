import fs from "fs";
import { OsuReader } from "./thing/reader.js";

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
console.log(data);

// create data folder
if (!fs.existsSync("./data")) {
    fs.mkdirSync("./data");
}

// write data to json file
if (fs.existsSync("./data/info.json")) {
    fs.writeFileSync("./data/info.json", JSON.stringify({ ...data, type: reader.type }, null, 2));
} else {
    fs.appendFileSync("./data/info.json", JSON.stringify({ ...data, type: reader.type }, null, 2));
}