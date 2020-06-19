import GIF from "./gif.js";
import WebM from "./whammy.js";

const { mod } = App;

const pngSignature = "\u0089PNG\u000d\u000a\u001a\u000a";

const playtest = (() => {
    let repeater;

    function forceResolve(event) {
        if (event.key === "Escape") repeater.abort();
    }

    return function playtest(playbackRate=1) {
        view.toggleOnionsVisible(false);
    
        if (view.ms >= Layer.trueEnd) view.ms = 0;
    
        repeater = repeat((i, timeElapsed) => {
            view.ms += timeElapsed * playbackRate;
        }, () => view.ms < Layer.trueEnd);
        
        repeater.promise.then(() => {
            removeEventListener("keydown", forceResolve, false);
            if (!repeater.aborted) view.ms = Layer.trueEnd;

            view.toggleOnionsVisible();
        });

        addEventListener("keydown", forceResolve, false);
    }
})();
qs(".playtest-button").addEventListener("click", () => {
    playtest();
}, false);

function exportWANIM() {
    /*
        chunk type  -  -  -  -   1  (ASCII str)
        chunk data byte length   8  (unsigned long)
        chunk data  -  -  -  -   n 

        [CHUNK TYPES]

        A : stuff [LENGTH = 12]
        width -  -  -  -  -  -   4  (unsigned int)
        height   -  -  -  -  -   4  (unsigned int)
        layer count -  -  -  -   4  (unsigned int)

        F : one animation frame [LENGTH = 71+]
        layer index -  -  -  -   4  (unsigned int)
        start -  -  -  -  -  -   4  (unsigned int)
        duration -  -  -  -  -   4  (unsigned int)
        image src   -  -  -  -  59+ (PNG image, no header)

        T : one transformation
        layer index -  -  -  -   4  (unsigned int)
        start -  -  -  -  -  -   4  (unsigned int)
        duration -  -  -  -  -   4  (unsigned int)
        ...
    */

    let data = "";

    data += formChunk("A", [settings.width, settings.height, Layer.layers.length]);
    for (let frame of Layer.allFrames()) {
        data += formChunk("F", [frame.layer.id, frame.start, frame.duration, fromDataURL(frame.src)]);
    }

    const array = toUint8Array(data);
    download(array, "thing.wanim");
    
    return data;

    function formChunk(type, data) {
        let str = "";
    
        for (let datum of data) {
            if (!isNaN(datum)) datum = toBinU8(datum);
    
            str += datum;
        }
    
        str = type + toBinU8(str.length, 8) + str;
    
        return str;
    }
}

function renderaGIF() {
    return new Promise(resolve => {
        const gif = new GIF({
            transparent: settings.gifTransparencyColor === null ? null : settings.gifTransparencyColor.toInteger(),
        });

        const images = [];
        const durations = [];
        App.collectFrames(frame => {
            const image = new Image();
            image.src = frame.src;
            images.push(image);

            durations.push(frame.duration);
        }, {
            bgColor: settings.gifTransparencyColor.toString(),
        });

        awaitAllLoad(images, () => {
            for (let i = 0; i < images.length; i++) {
                gif.addFrame(images[i], { delay: durations[i] });
            }

            gif.on("finished", resolve);

            gif.render();
        });
    });
}
function exportaGIF() {
    renderaGIF().then(blob => { let url; open(url = URL.createObjectURL(blob)).onclose = () => { URL.revokeObjectURL(url); }; showZone("timeline"); });
}

function renderaWEBM() {
    return new Promise(resolve => {
        const webm = new WebM();

        App.collectFrames(frame => {
            webm.add(frame.src, frame.duration);
        }, {
            imageMIME: "image/webp",
        });

        webm.compile(resolve);
    });
}
function exportaWEBM() {
    renderaWEBM().then(blob => { let url; open(url = URL.createObjectURL(blob)).onclose = () => { URL.revokeObjectURL(url); }; showZone("timeline"); });
}
/*
function renderaPNG() {
    return new Promise(async function (resolve, reject) {
        // Merge all frames.
        const frames = await Layer.mergeAll();
    
        // IHDR and IEND can be ripped from a single frame.
        const referencePNG = fromDataURL(frames[0].src);
        const ihdr = getChunk("IHDR");
        const iend = getChunk("IEND");

        // Begin forming the image data.
        let data = pngSignature + ihdr;

        data += formChunk("acTL", [
            toBinU8(frames.length),
            toBinU8(0)
        ]);
    });

    function formChunk(type, data, crc) {
        let str = "";
    
        for (let datum of data) {
            str += datum;
        }
    
        str = toBinU8(str.length) + type + str + crc;
    
        return str;
    }

    function getChunk(name) {
        const index = referencePNG.indexOf(name) - 4;
        const length = fromBinU8(referencePNG.substr(index, 4));
        const chunkData = refrencePNG.substr(index, length + 12);

        return chunkData;
    }
}*/

function exportfPNG() {
    console.log(view.currentFrame(true).src);
}


function importFile(useObjectURL, readAs) {
    return new Promise(resolve => {
        const input = createElement("input");

        input.type = "file";
        input.style.display = "none";

        input.onchange = function () {
            const files = input.files;
            input.remove();
            
            if (files.length === 0) return;

            const file = files[0];

            if (useObjectURL) {
                resolve(URL.createObjectURL(file));
            } else {
                const reader = new FileReader();
                reader.onload = function () {
                    resolve(reader.result);
                };
        
                switch (readAs) {
                    default:
                        reader.readAsBinaryString(file);
                        break;
                    
                    case "dataURL":
                        reader.readAsDataURL(file);
                        break;
                }
            }
        };

        document.body.appendChild(input);
        input.click();
    });
}

async function importWANIM(data) {
    reset();

    const frames = [];

    let i = 0;
    let chunkI;
    let chunkLength;

    nextChunk();

    function nextChunk() {
        const chunkType = dataSubstr(1);
        chunkLength = dataSubstrNumber(8);
        chunkI = 0;

        switch (chunkType) {
            case "A": {
                settings.width = dataSubstrNumber(4);
                settings.height = dataSubstrNumber(4);
                resizeCanvas(settings.width, settings.height);

                let layerCount = dataSubstrNumber(4);
                for (let j = 0; j < layerCount; j++) {
                    Layer.add();
                }

                break;
            }
            
            case "F": {
                let index = dataSubstrNumber(4);
                let start = dataSubstrNumber(4);
                let duration = dataSubstrNumber(4);
                let src = dataSubstr(chunkLength - chunkI);
                frames.push({ index, start, duration, src });

                break;
            }
                
            default:
                console.warn(
                    `Unrecognized chunk type "${chunkType}" (${chunkType.charCodeAt().toString(16)}), will ignore.`
                );
                iPE(chunkLength);
        }

        if (i < data.length) {
            nextChunk();
        } else {
            createFrames();
        }
    }

    function createFrames() {
        for (let frame of frames) {
            Layer.layers[frame.index].frames.add({
                start: frame.start,
                duration: frame.duration,
                src: frame.src ? "data:image/png;base64," + btoa(pngSignature + frame.src) : "",
            }, false);
        }
        for (let layer of Layer.layers) {
            layer.frames.sort();
        }
    }

    function dataSubstrNumber(length) {
        return fromBinU8(dataSubstr(length));
    }

    function dataSubstr(length) {
        const s = data.substr(i, length);
        iPE(length);
        return s;
    }

    function iPE(n) {
        i += n;
        if (!isNaN(chunkI)) {
            chunkI += n;
        }
        return i;
    }

    function fromBinU8(str) {
        let sum = 0;
        str.split("").reverse().forEach((char, i) => {
            sum += char.charCodeAt() * 256 ** i;
        });
        return sum;
    }
}

function importImage(url) {
    const image = newImage(url, image => {
        view.currentLayer.canvas.image(image);
        view.currentLayer.recordFrame();
        URL.revokeObjectURL(url);
    });
}

async function importVideo(url, fuzz=.03) {
    //reset();

    const video = createElement("video");

    let time = 0;
    const frameRate = 30;
    const canvas = new Canvas();
    const frames = [];
    let frameDataPrev = [];
    video.addEventListener("loadeddata", () => {
        resizeCanvas(video.videoWidth, video.videoHeight);
        canvas.width(video.videoWidth).height(video.videoHeight);

        draw();
    });
    video.addEventListener("seeked", draw, false);

    video.src = url;

    async function nextFrame() {
        if (time < video.duration * frameRate) {
            video.currentTime = time / frameRate;
            time++;
        } else {
            createFrames();
        }
    }

    function draw() {
        canvas.image(video);

        let frameData = canvas.toImageData().data;
        if (compareArrays(frameData, frameDataPrev)) {
            last(frames).duration = Math.round(last(frames).duration + 1000 / frameRate);
        } else {
            frames.push({
                start: Math.round(time * 1000 / frameRate),
                duration: Math.round(1000 / frameRate),
                src: canvas.toSrc(),
            });

            frameDataPrev = frameData;
        }

        nextFrame();
    }

    async function createFrames() {
        const layer = Layer.add(view.layerid + 1);
        for (let frame of frames) {
            layer.frames.add({
                start: frame.start,
                duration: frame.duration,
                src: frame.src
            }, false);
        }
        layer.frames.arrange("back");
        Layer.refreshAllCanvases();
        URL.revokeObjectURL(url);
    }
}

qs(".exporta-wanim").addEventListener("click", () => {
    exportWANIM();
}, false);

qs(".exporta-gif").addEventListener("click", () => {
    exportaGIF();
}, false);

qs(".exporta-webm").addEventListener("click", () => {
    exportaWEBM();
}, false);

/*qs(".exporta-png").addEventListener("click", () => {
    exportaPNG();
}, false);*/

qs(".exportf-png").addEventListener("click", () => {
    exportfPNG();
}, false);

qs(".import-wanim").addEventListener("click", async () => {
    importFile(false).then(async url => {
        await importWANIM(url);
        showZone("timeline");
    });
}, false);

qs(".import-video").addEventListener("click", async () => {
    importFile(true).then(async dataURL => {
        await importVideo(dataURL);
        showZone("timeline");
    });
}, false);

qs(".import-image").addEventListener("click", () => {
    importFile(true).then(dataURL => {
        importImage(dataURL);
        showZone("timeline");
    });
}, false);


addEventListener("paste", event => {
    const item = event.clipboardData.items[0];

    if (item.kind === "file") {
        let reader = new FileReader();
        reader.onload = () => {
            importImage(reader.result);
        };
        reader.readAsDataURL(item.getAsFile());
    }
}, false);


// Utility functions //

function toBinU8(num, length=4) {
    const bin = 
        num.toString(2)                             // Represent the number in binary.
        .padStart(8 * length, "0")                  // Prepend trailing zeroes.
        .match(/.{8}/g)                             // Split the resulting string into chunks of length 8.
        .map(e => parseInt(e, 2));                  // Parse each entry in the resulting array back to a number.
    
    return String.fromCodePoint(...bin);            // Map each number in the resulting array to its corresponding Unicode character.
}

function toBin8(num, length=4) {
    const bin = 
        (Number(num < 0) +                          // Add the bit for the sign.
        num.toString(2)                             // Represent the number in binary.
        .padStart(8 * length - 1, "0")              // Prepend trailing zeroes
        .slice(-8 * length - 1))                    // Crop the resulting string from the front so that the string’s length is [8 * length − 1] (one space left for the sign).
        .match(/.{8}/g)                             // Split the resulting string into chunks of length 8.
        .map(e => parseInt(e, 2));                  // Parse each entry in the resulting array back to a number.            
    
    return String.fromCodePoint(...bin);            // Map each number in the resulting array to its corresponding Unicode character.
}

function repeat(func, amount, delay=0) {
    let start;
    let i = 0;

    let id;
    let res;

    let continuing;
    if (typeof amount === "function") {
        continuing = amount;
    } else {
        continuing = () => i < amount;
    }

    const object = {
        promise: null,

        abort() {
            this.aborted = true;

            cancelAnimationFrame(id);
            res(i);
        },

        aborted: false,
    };
    
    object.promise = new Promise(resolve => {
        res = resolve;
        start = Date.now();
        requestAnimationFrame(function iterate() {
            if (continuing()) {
                id = requestAnimationFrame(iterate);
            } else {
                res(i);
            }
            
            const timeElapsed = Date.now() - start;
            if (timeElapsed >= delay) {
                func(i++, timeElapsed);
                start = Date.now();
            }
        });
    });

    return object;
}

function toUint8Array(data) {
    const array = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
        array[i] = data.charCodeAt(i);
    }
    return array;
}

function reset() {
    for (let layer of Layer.layers) {
        layer.delete();
    }
}

function fromDataURL(src) {
    return atob(src.substring(src.indexOf(",") + 1)).substring(8);
}

function replaceInString(str, index, substr) {
    index = mod(index, str.length);

    return str.substr(0, index) + substr + str.substr(index + substr.length);
}

function compareArrays(a, b) {
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }

    return true;
}

function awaitAllLoad(imageArray, callback) {
    let imagesRemaining = imageArray.length;
    for (let image of imageArray) {
        if (image.complete || image.naturalWidth > 0) {
            tickdown();
            continue;
        }

        image.addEventListener("load", tickdown, { once: true });
    }

    function tickdown() {
        if (--imagesRemaining <= 0) callback();
    }
}

const download = (() => {
    const a = createElement("a");
    a.style.display = "none";
    document.body.appendChild(a);

    return function (object, filename) {
        const blob = new Blob([object], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);

        a.href = url;
        a.download = filename;
        a.click();
    
        URL.revokeObjectURL(url);
    };
})();