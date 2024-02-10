import { OsuReader } from "./scripts/reader.js";

const osu_file = document.getElementById("osu_file");
const collecion_file = document.getElementById("collecion_file");
const button = document.getElementById("go");

const buffers = new Map();
const can_run = [false, false];

// i could use filter but fuck it 
const remove_same_id_shit = (maps) => {
    const ids = [], no = [];

    if (maps.length == 0) {
        return;
    } 
    
    maps.map((v) => {
      
      if (!v) {
          return;
      }

      if (ids.includes(v)) {
          return;
      }

      no.push(v);
      ids.push(v);
    });

    return no;
};

const append_to_cu = (img_src, artist, title, mapper) => {

  const new_div = document.createElement('div');
  new_div.className = 'osu-popup';

  const img_element = document.createElement('img');
  img_element.src = img_src;
  img_element.alt = 'title';

  const h1_element = document.createElement('span');
  h1_element.innerHTML = artist + ' - ' + title + '<br>' + 'mapped by ' + mapper;

  new_div.appendChild(img_element);
  new_div.appendChild(h1_element);

  const target_div = document.getElementById('maps');

  target_div.appendChild(new_div);
}

osu_file.addEventListener("change", (e) => {

    if (!buffers.has("osu")) {
        const reader = new FileReader();
        reader.onload = () => {
            const array_buffer = reader.result;
            buffers.set("osu", array_buffer);
            can_run[0] = true;
        };
        reader.readAsArrayBuffer(e.target.files[0]);
    }
});

collecion_file.addEventListener("change", (e) => {

    console.log(e.target.files);

    if (!buffers.has("collection")) {

        const reader = new FileReader();
        reader.onload = () => {
            const array_buffer = reader.result;
            buffers.set("collection", array_buffer);
            can_run[1] = true;
        };

        reader.readAsArrayBuffer(e.target.files[0]);
    }
});

const reader = new OsuReader();

const get_data = async () => {

    reader.set_type("collection");
    reader.set_buffer(buffers.get("collection"));
    await reader.get_collections_data();

    reader.set_type("osu");
    reader.set_buffer(buffers.get("osu"));
    await reader.get_osu_data();
};

let doing = false;
button.addEventListener("click", async () => {

    if (!can_run[0] || !can_run[1] || doing) {
        return;
    }

    doing = true;

    const type = document.getElementById("type").value;
    const main = document.querySelector(".main");
    let collections = [];

    await get_data();

    const beatmapHashes = new Map();
    for (const beatmap of reader.osu.beatmaps) {
      beatmapHashes.set(beatmap.md5, { title: beatmap.song_title, artist: beatmap.artist_name, id: beatmap.beatmap_id, mapper: beatmap.creator_name });
    }

    if (type == "display") {

        await new Promise((res, rej) => {

            try {
                const select = document.createElement("select");
                const label = document.createElement("label");

                label.innerHTML = "collection name";
                
                for (let i = -1; i < reader.collections.length; i++) {

                    const value = document.createElement("option");

                    if (reader.collections.beatmaps[i]) {
                        value.value = reader.collections.beatmaps[i].name;
                        value.innerText = reader.collections.beatmaps[i].name;
                    }

                    select.appendChild(value);
                }

                main.insertBefore(label, button);
                main.insertBefore(select, button);

                const do_filter = (e) => {

                    const name = e.target.value;
                    const target_collection = reader.collections.beatmaps.filter((c) => c.name == name);

                    collections = target_collection;

                    select.removeEventListener("change", do_filter, false);

                    main.removeChild(select);
                    main.removeChild(label);

                    res();
                };

                select.addEventListener("change", do_filter, false);

            } catch(error) {
                console.log(error);
                alert("something went wrong\ncheck console for more information.");
                return;
            }            
        });

        let index = 0;

        const interval = setInterval(() => {

          if (index > collections[0].maps.length) {
              clearInterval(interval);
          }

          const map = beatmapHashes.get(collections[0].maps[index]);
          if (!map) {
              return;
          }

          const title = map.title;
          const artist = map.artist;
          const id = map.id;

          append_to_cu(`https://assets.ppy.sh/beatmaps/${id}/covers/cover@2x.jpg`, artist, title, map.mapper);
          index++;

        }, 100);

        doing = false;
        
        return;
    }
  
    let maps = [];
    for (const collection of reader.collections.beatmaps) {
      for (const hash of collection.maps) {
        if (!beatmapHashes.has(hash)) {
            maps.push(
              hash
            );
        }
      }
    }

    maps = remove_same_id_shit(maps);
    if (maps.length == 0) {
        return append_to_cu("invalid", "0 maps found", "", "");
    }

    console.log(maps);

    const api_url = "https://api.osu.direct";
    const want_to_download = confirm("click yes to download");

    let downloaded = 0;

    if (!want_to_download) {
        alert("sure...");
        return;
    }

    for (const md5 of maps) {

        try {
            // verify if the beatmapset exist's
            const set_response = await fetch(`${api_url}/v2/md5/${md5}`, {
                headers: {
                    "Content-Type": "Application/json"
                }
            });

            const set = await set_response.json();

            if (!set.beatmapset_id) {
                console.log("beatmapset not found");
                continue;
            }

            // download it 
            const beatmap = await fetch(`${api_url}/d/${set.beatmapset_id}`, {
                method: "GET"
            });

            const buffer = await beatmap.arrayBuffer();
            const blob = new Blob([buffer], { type: "application/octet-stream" });

            const link = document.createElement("a");
            const url = window.URL.createObjectURL(blob);

            link.href = url;
            link.download = `${md5}.osz`;

            document.body.appendChild(link);
            link.click();

            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            downloaded++;

        } catch(error) {

            if (error.status == 404) {
                console.log("set not found");
            }
            else {
                console.log(error);
            }
        }
    }

    if (downloaded > 0) {
        alert(`finished download all ${downloaded} maps :3`);
    }

    doing = false;
});