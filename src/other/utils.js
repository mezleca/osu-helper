import fs from "fs";
import path from "path";
import readline from "readline-sync";
import Terminal from "terminal-kit";

import { config } from "./config.js";
import { auth } from "osu-api-extended";

const missing_config = [];
const terminal = Terminal.terminal;

export const show_menu = (list) => new Promise((resolve, reject) => {
    console.log("Select a option: ");
    terminal.singleColumnMenu(list.map((a) => "-> " + a.name), async (err, res) => {

        const item = list[res.selectedIndex];

        if (err) {
            console.log("ERROR");
            process.exit();
        }

        if (!item.callback) {
            console.log("Missing callback");
            reject();
        }
        
        console.log("\n");

        await item.callback();

        resolve();
    });
});

const prompt = (question) => {
    return readline.question(question);
};

export const check_login = async () => {
    try {  
        const login = await auth.login(config.get("osu_id"), config.get("osu_secret"), ['public']);
        if (login.access_token) { 
            return login;  
        }
             
        console.log("hmm it seems your osu_id / osu_secret is invalid...\nmake sure to use the correct shit in the config.js file");
        process.exit(1);     
    } catch (err) {
        console.log("Failed to connect to osu api\nTo use all features restart the script\n");
    }
};

export const check_config = async () => {

    console.clear();
    
    for (const [key, value] of config.entries()) {
        if (value === '') {
            console.log(`config for ${key} not found!`);
            missing_config.push(key);
        }
    }
    
    if (missing_config.length > 0) {

        console.log("\nenter the following values\n");
    
        for (const key of missing_config) {
            let value = await handle_prompt(`${key}: `);
            value = value.replace(/\\/g, '\\\\');
            config.set(key, value);
        }
    
        // yep this is still pretty bad
        const text = `import { check_config } from "./utils.js";\nexport const config = new Map();\n\n// Update the config files HEREE!!!!!!!!!!!!!!!:\n${Array.from(config).map(([k, v]) => `config.set("${k}", "${v}");`).join('\n')}\n\nawait check_config();`
    
        // update the config.js file
        fs.writeFileSync(path.resolve("./src/other/config.js"), text);

        // :3
        console.log("\n");
    }

    console.clear();
};

export const check_path = () => {
    
    const osu_path_exist   = fs.existsSync(config.get("osu_path"));
    const songs_path_exist = fs.existsSync(config.get("osu_songs_folder"));

    if (osu_path_exist && songs_path_exist) {
        return;
    }

    console.log("your osu path is invalid!\nplease update your config.js file with the osu / osu songs correct path");
    process.exit(1);
};

export const handle_prompt = async (question) => {
    process.stdout.write(question);
    const answer = await terminal.inputField().promise;
    console.log("\n");
    if (answer == "exit") {
        console.log("ok");
        process.exit(0);
    }
    return answer;
};