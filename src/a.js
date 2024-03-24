import { OsuReader } from "./reader/reader.js";
import fs from "fs";

// test

const reader = new OsuReader();
const file = fs.readFileSync("C:\\Users\\nameh\\AppData\\Local\\osu!\\osu!.db");

reader.set_buffer(file);

// surely limit will work now :clueless:
reader.get_osu_data(32);

console.log(reader.osu.beatmaps.length);