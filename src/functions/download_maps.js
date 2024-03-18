import fs from "fs";
import path from "path";
import PromptSync from "prompt-sync";
import axios from "axios";

const base_url = "https://api.nerinyan.moe/d/";
const prompt = PromptSync();

export const download_initialize = async () => {

    console.log("\nWARN: make sure your input file is a json and have this format\n-> ['https://osu.ppy.sh/beatmapsets/id_here', ...]\n");

    let file_path = prompt("enter the file path: ");
    const format = file_path.split(".");

    if (format[format.length - 1] != "json") {

        const all_files = fs.readdirSync(file_path);
        const maybe_a_valid_one = all_files.find((v) => v.split(".").includes("json"));

        if (!maybe_a_valid_one) {
            return;
        } 

        file_path = path.resolve(file_path, maybe_a_valid_one);
    }

    // verify if the file exists
    if (!fs.existsSync(path.resolve(file_path))) {
        console.log("file not found");
        return;
    }

    const file = fs.readFileSync(path.resolve(file_path), "utf-8");
    const json = JSON.parse(file);

    console.log("downloading", json.length, "maps...");

    for (let i = 0; i < json.length; i++) {

        const a = json[i].split("/");
        const b = a[a.length - 1];

        const response = await axios.get(`${base_url}${b}`, {
            method: "GET",
            responseType: "stream",
            headers: {
                "Content-Type": "application/x-osu-beatmap-archive"
            }
        });

        if (response.statusText != "OK") {
            console.log("cannot find " + b);
            return;
        }

        const stream = fs.createWriteStream(path.resolve("./data/", `${b}.osz`));
        response.data.pipe(stream);

        await new Promise((resolve, reject) => {
            stream.on("finish", resolve);
            stream.on("error", (err) => {
                console.error("error:", b, err);
                reject(err);
            });
        });
    }

    console.log("\ndone!");
};
