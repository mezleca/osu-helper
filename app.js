import { OsuReader } from "./scripts/reader.js";

const directory = document.getElementById("directory");
const button = document.getElementById("go");
const directory_button = document.querySelector(".dir");

const buffers = new Map();
const can_run = [false, false];

let doing = false, created_div = false;

const test = [
  {
    id: 419879,
    artist: "black coast",
    title: 'trndsttr'
  },
  {
    id: 2125044,
    artist: "-45",
    title: "crimsonic dimension"
  }
]

const remove_same_id_shit = (maps) => {
  
    if (maps.length === 0) {
        return [];
    } 
    
    const unique_ids = maps.filter((value, index, self) => {
        return self.indexOf(value) === index;
    });

    return unique_ids;
}; 

const append_map = (img_src, artist, title, mapper) => {

  const new_div = document.createElement('div');
  new_div.className = 'osu-popup';

  const img_element = document.createElement('img');
  img_element.src = img_src;
  img_element.alt = 'title';

  const a_element = document.createElement('a');
  a_element.innerHTML = artist + ' - ' + title + '<br>' + 'mapped by ' + mapper;
  
  const id = img_src.split("/")
  
  a_element.href = `https://osu.ppy.sh/beatmapsets/${id[id.length - 3]}`;

  new_div.appendChild(img_element);
  new_div.appendChild(a_element);

  const target_div = document.getElementById('maps');

  target_div.appendChild(new_div);
}

const create_container = (test) => {
  
    const title_exist = document.getElementById("title");
    var maps_exist = document.getElementById("maps");
    
    if (title_exist) {
      
        title_exist.innerText = test ? "preview" : "maps";
        
        if (maps_exist) {
            maps_exist.remove();
            maps_exist = false;
        }
        
    }

    const main_div = document.querySelector(".container");
    const container = document.createElement("div");
    
    if (!maps_exist) {
      
        const title = document.createElement("h1");
        
        title.setAttribute("id", "title");
        title.innerText = test ? "preview" : "maps";
        
        container.appendChild(title);
    }
    
    container.setAttribute("class", "maps_container");
    container.setAttribute("id", "maps");

    if (!maps_exist) {
        main_div.appendChild(container);  
    }
};

const reader = new OsuReader();

const get_data = async () => {

    reader.set_type("collection");
    reader.set_buffer(buffers.get("collection"));
    await reader.get_collections_data();

    reader.set_type("osu");
    reader.set_buffer(buffers.get("osu"));
    await reader.get_osu_data();
};

const get_file_from_dir = (e) => {
 
    const files = [];

    for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        if (file.name == "collection.db" || file.name == "osu!.db") {
            files.push(file);
        }
    }

    if (files.length != 2) {
        throw new Error("some files cannot be found...\ntry loading the correct directory");
    }

    for (let i = 0; i < files.length; i++) {

        const reader = new FileReader();
        reader.onload = () => {

            const array_buffer = reader.result;
            const type_name = files[i].name == "collection.db" ? "collection" : "osu" || null;

            if (type_name == null) {
                throw new Error("some files cannot be found...\ntry loading the correct directory");
            }

            buffers.set(type_name, array_buffer);

        };

        reader.readAsArrayBuffer(files[i]);
    }

    if (buffers.has("osu")) {
        can_run[0] = true;
    }
    
    if (buffers.has("collection")) {
        can_run[1] = true;
    }

    if (can_run[0] && can_run[1]) {

        // "remove" input div
        const dir = document.querySelector(".dir");
        const dir_label = document.querySelector("#dir_label");

        dir.style.display = none;
        dir_label.style.display = none;
    }
};

const do_preview = () => {

    // preview thing

    create_container(true);
          
    doing = true;
    created_div = true;

    for (let i = 0; i < test.length; i++) {
      
        const map = test[i];      
        const title = map.title;
        const artist = map.artist;
        const id = map.id;
        
        append_map(`https://assets.ppy.sh/beatmaps/${id}/covers/cover@2x.jpg`, artist, title, "test");
    }
    
    doing = false;
};

directory_button.addEventListener("click", () => {

     // check if buffer already exist's
     if (buffers.has("osu") || buffers.has("collection")) {
          alert("files have already loaded!");
          return;
     }

     const input = document.createElement("input");
     input.type = "file";
     input.setAttribute("webkitdirectory", true);

     input.click();

     input.addEventListener("change", (e) => {
        get_file_from_dir(e);
        input.removeEventListener("change", get_file_from_dir, false);
     }, false);
});

button.addEventListener("click", async () => {

    const type = document.getElementById("type").value;
    const main = document.querySelector(".main");

    const invalid_buffer = !can_run[1] && !can_run[0];

    let collections = [];
    let index = 0;
  
    if (buffers.has("osu")) {
        can_run[0] = true;
    }
    
    if (buffers.has("collection")) {
        can_run[1] = true;
    }
  
    if (invalid_buffer && !doing) {
        do_preview();
        return;
    }

    // if there's no osu file and type id missing: return
    if (!can_run[0] && type == "missing") {
        alert("make sure the directory includes the osu db file");
        return;
    }
  
    create_container(false);

    doing = true;
    created_div = true;
    
    await get_data();

    const hashes = new Map();
    for (const beatmap of reader.osu.beatmaps) {
      hashes.set(beatmap.md5, { title: beatmap.song_title, artist: beatmap.artist_name, id: beatmap.beatmap_id, mapper: beatmap.creator_name });
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

        const interval = setInterval(() => {

          if (index > collections[0].maps.length) {
              clearInterval(interval);
          }

          const map = hashes.get(collections[0].maps[index]);
          if (!map) {
              return;
          }

          const title = map.title;
          const artist = map.artist;
          const id = map.id;

          append_map(`https://assets.ppy.sh/beatmaps/${id}/covers/cover@2x.jpg`, artist, title, map.mapper);
          index++;

        }, 100);

        doing = false;
        
        return;
        
    } 
    
    if (type == "missing") {
      
            let maps = [];
            for (const collection of reader.collections.beatmaps) {
              for (const hash of collection.maps) {
                if (!hashes.has(hash)) {
                  maps.push(
                    hash
                  );
                }
              }
            }
        
            maps = remove_same_id_shit(maps);
            if (maps.length == 0) {
              return append_map("invalid", "0 maps found", "", "");
            }
        
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
        
              } catch (error) {
        
                if (error.status == 404) {
                  console.log("set not found");
                }
                else {
                  console.log(error);
                }
              }
            }
        
            if (downloaded > 0) {
              alert(`finished downloading all ${downloaded} maps :3`);
            }
        
            doing = false;
    }
    else {
        // TODO
        doing = true;
    }
});