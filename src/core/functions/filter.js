import { handle_prompt } from "../../other/utils.js";

const default_filter = {
    star: {
        enabled: false,
        min: 0,
        max: 0
    },
    status: {
        enabled: false,
        mode: 0, // 0 = equal, 1 = not equal,
        value: "" // only (ranked, loved, graveyard, approved) for now
    },
};

export let filter = default_filter;

// ...
// also i need to make this func save the in filter on the config file.
export const update_filter = async () => {

    const properties = ["star", "status"];
    const operations = [">", "<", "==", "!="];

    console.clear();

    console.log("Simple filter | W.I.P");
    console.log("Warning: if you restart the script, the filter will be also be reseted\n");

    console.log("Available Options:", properties.join(", "), "\n");

    console.log("-- Usage: (Use a option followed by a operation [ > < == != ] and the value separated by spaces)\n\n-- Examples:\n\nstar > 5\nstar < 7\nstatus == loved\n");

    const value = await handle_prompt("filter: ");

    const splitted = value.split(" ");

    for (let i = 0; i < splitted.length; i++) {

        const w = splitted[i];

        if (properties.includes(w)) {

            const op = splitted[i + 1];
            const nb = Number(splitted[i + 2]);
            const str = splitted[i + 2];

            if (w == "star") {
                
                if (!nb || isNaN(nb)) {
                    console.log("Invalid number in star filter");
                    break;
                }

                if (!op || !operations.includes(op)) {
                    console.log("Invalid operation in star filter");
                    break;
                }

                if (op == ">") {
                    filter[w].enabled = true;
                    filter[w].min = nb;
                    i += 2;
                    continue;
                }

                if (op == "<") {
                    filter[w].enabled = true;
                    filter[w].max = nb;
                    i += 2;
                    continue;
                }

                if (op == "==") {
                    filter[w].enabled = true;
                    filter[w].max = nb;
                    filter[w].min = nb;
                    i += 2;
                    continue;
                }

                console.log("Invalid filter for", w);
                break;
            }

            if (w == "status") {

                if (!str || typeof str != "string") {
                    console.log("Invalid text in status filter");
                    break;
                }

                if (!op || !operations.includes(op)) {
                    console.log("Invalid operation in status filter");
                    break;
                }

                if (op == "==") {
                    filter[w].enabled = true;
                    filter[w].mode = 0;
                    filter[w].value = str;
                    i += 2;
                    continue;
                }

                if (op == "!=") {
                    filter[w].enabled = true;
                    filter[w].mode = 1;
                    filter[w].value = str;
                    i += 2;
                    continue;
                }

                console.log("Invalid filter for", w);
                break;
            }
        }
    }

    const ft = JSON.stringify(filter, null, 4);

    console.log(ft, "\n");

    const prompt = await handle_prompt("wanna save the filter?: ");

    if (prompt != "y") {
        filter = default_filter;
    }

    console.clear();

    console.log("updated filter\n");
};