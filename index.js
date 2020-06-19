"use strict";


function qs(query, element=document) {
    return element.querySelector(query);
}
function qsa(query, element=document) {
    return element.querySelectorAll(query);
}

if (![].flat) {
    Array.prototype.flat = function () {
        return [].concat.apply([], this);
    };
}

/** TODO
 *  
 *  # <div class="files-zone" />. --basics done
 *  # Frame trimming and offsets. --LATER
 *  # Layer transformations.      --DONE
 *  # Keyboard shortcuts.
 *  # Selections and copy/paste.
 *  # Applying transformations to the draft. --DONE
 *  # PNG exports.
 *  # GIF/PNG imports. --PNG DONE
 *  # 
 * 
 * Frame trimming :
 *  After stroke: Offset each point, draw onto drawer-sized canvas, and record trimming.
 *    (left) = (buffer canvas left) + (trim left) - (layer canvas left)
 *  Transfer cropped image onto layer canvas, and then use CSS to move it on the display.
 *  Frames should contain data about offsets.
 */

const drawerBG = qs(".background");
const onions = new Canvas(".onions");
const layersContainer = qs(".layers");

const drawingZone = qs("drawing-zone");
const drawer = new Canvas(".drawer");

const settings = (() => {
    let width;
    let height;

    let strokeWidth;
    let cap;
    let joint;

    let gco;

    let color;

    let gifTransparencyColor;

    const cursor = qs(".cursor");

    drawer.canvas.addEventListener("mousemove", event => {
        const offset = strokeWidth / 2 + parseInt(getComputedStyle(cursor).borderWidth);

        cursor.style.left = `${event.x - offset}px`;
        cursor.style.top = `${event.y - offset}px`;
    }, false);

    const brushSizeSlider = qs(".brush-size-slider");
    const colorInput = qs(".color-input");

    return {
        get width() {
            return width;
        },
        set width(value) {
            width = valuecheck(value, { min: 1, integer: true });
            resizeCanvas(value, this.height);
        },

        get height() {
            return height;
        },
        set height(value) {
            height = valuecheck(value, { min: 1, integer: true });
            resizeCanvas(this.width, value);
        },
    
        get strokeWidth() {
            return strokeWidth;
        },
        set strokeWidth(value) {
            drawer.strokeWidth(value);
            strokeWidth = drawer.strokeWidth();

            cursor.style.width = `${value}px`;
            cursor.style.height = `${value}px`;
            
            const y = Math.min(104, Math.max(0, Math.sqrt(value / 100) * 104));
            
            brushSizeSlider.setAttribute("transform", `translate(0 ${y})`);
            qs("text", brushSizeSlider).textContent = value.toFixed(2);
        },
        get cap() {
            return cap;
        },
        set cap(value) {
            drawer.cap(value);
            cap = drawer.cap();
        },

        get joint() {
            return joint;
        },
        set joint(value) {
            drawer.joint(value);
            joint = drawer.joint();
        },

        get color() {
            return color;
        },
        set color(value) {
            color = new Color(value);

            colorInput.value = color.toString("hex");
        },

        get gifTransparencyColor() {
            return gifTransparencyColor;
        },
        set gifTransparencyColor(value) {
            gifTransparencyColor = value ? new Color(value) : null;
        },
    
        get gco() {
            return gco;
        },
        set gco(value) {
            gco = value;

            drawer.style(this.getGCOColor());
        },
        gcoColors: {
            "destination-out": new Color("red"),
        },
        getGCOColor() {
            return this.gcoColors[this.gco] || new Color();
        },
    
        aliasingEnabled: true,
    
        simplifyThreshold: 3 / 200 * Math.PI,
    
        defaultFrameDuration: 500,
        minOutlierInbetweenRatio: 1.5, // > 1 always

        get minOutlierDuration() {
            return this.defaultFrameDuration * this.minOutlierInbetweenRatio;
        },
    
        setSimplifyThresholdPercentage(percent) {
            this.simplifyThreshold = valuecheck(percent / 200 * Math.PI, { min: 0, max: 2 * Math.PI });
        },
        getSimplifyThresholdPercentage() {
            return this.simplifyThreshold * 200 / Math.PI;
        },
    };
})();

const view = (() => {
    let layerid = -1;
    let ms = 0;

    const defaultTimelineZoomScale = 2;
    let timelineZoomScale = defaultTimelineZoomScale; // ms : px

    let timelineZoomScrollFactor = 1.25;

    let onionsAlpha = 85;
    let onionsAlphaDivisor = 2;
    let onionsBehind = 3;
    let onionsAhead = 0;

    return {
        get layerid() {
            return layerid;
        },
        set layerid(value) {
            //if (value === layerid) return;

            if (this.currentLayer) {
                this.currentLayer.timelineElement.classList.remove("selected");
                this.currentLayer.canvas.canvas.classList.remove("selected");
            }
            layerid = valuecheck(value, { min: 0, max: Layer.layers.length - 1, integer: true });
            this.currentLayer.timelineElement.classList.add("selected"); // different .currentLayer return value
            this.currentLayer.canvas.canvas.classList.add("selected");

            timeline.updateFrameInputs();

            this.updateOnions();
        },
        
        get ms() {
            return ms;
        },
        set ms(value) {
            if (!isFinite(value)) return;

            ms = valuecheck(value, { min: 0, integer: true });

            timeline.moveTimebar();
            timeline.updateClock();
            Layer.refreshAllCanvases();

            timeline.updateFrameInputs();

            this.updateOnions();
        },
    
        get timelineZoomScale() {
            return timelineZoomScale;
        },
        set timelineZoomScale(value) {
            if (value <= 0 || value === timelineZoomScale || isNaN(value)) return;

            timelineZoomScale = value;
        
            timeline.resizeFrames();
            timeline.resizeLayers();
            timeline.moveTimebar();
        },

        get timelineZoomScrollFactor() {
            return timelineZoomScrollFactor;
        },
        set timelineZoomScrollFactor(value) {
            if (value <= 1 || isNaN(value)) return;

            timelineZoomScrollFactor = value;
        },

        get currentLayer() {
            return Layer.layers[this.layerid];
        },
        currentFrame(allowUnreal) { // turn into two getters
            return this.currentLayer.frames.itemAt(view.ms, allowUnreal);
        },
        get currentFrameList() {
            return this.currentLayer.frames;
        },
        get currentTransitionList() {
            return this.currentLayer.transitions;
        },
        get currentCopyList() {
            return this.currentLayer.copies;
        },
    
        currentFramePrev() {
            return this.currentFrameList.itemPreceding();
        },
    
        frameNext() {
            this.ms = this.currentFrame(true).end;
        },
        framePrev() {
            const framePrev = this.currentFrameList.fillBlanks(Infinity).itemAt(this.currentFrame(true).start - 1);
            this.ms = framePrev ? framePrev.start : 0;
        },

        deleteCurrentFrame() {
            const frame = this.currentFrame();
            if (frame) {
                frame.remove();
                view.currentLayer.refreshCanvas();
                return true;
            }
            return false;
        },
    
        get onionsAlpha() {
            return onionsAlpha;
        },
        set onionsAlpha(value) {
            if (value <= 0 || onionsAlpha === value) return;

            onionsAlpha = value;
        },

        get onionsAlphaDivisor() {
            return onionsAlphaDivisor;
        },
        set onionsAlphaDivisor(value) {
            if (value <= 1 || onionsAlphaDivisor === value) return;

            onionsAlphaDivisor = value;
        },

        get onionsBehind() {
            return onionsBehind;
        },
        set onionsBehind(value) {
            if (onionsBehind === value) return;

            onionsBehind = valuecheck(value, { min: 0, integer: true });
        },

        get onionsAhead() {
            return onionsAhead;
        },
        set onionsAhead(value) {
            if (onionsAhead === value) return;

            onionsAhead = valuecheck(value, { min: 0, integer: true });
        },
        getOnionFrames() {
            const frame = this.currentFrame(true); //this.currentFrameList.fillBlanks(Infinity, true).itemAt();
    
            return [
                frame.getPrecedents(this.onionsBehind).reverse(),
                frame.getSuccedents(this.onionsAhead)
            ];
        },

        get onionsVisible() {
            return onions.canvas.classList.contains("hidden");
        },
        toggleOnionsVisible(state) {
            if (state !== undefined) state = !state;
            
            return onions.canvas.classList.toggle("hidden", state);
        },
        
        updateOnions() {
            onions.clear();
        
            const onionFrames = this.getOnionFrames();
        
            for (let frameSet of onionFrames) {
                let opacity = this.onionsAlpha;
        
                for (let frame of frameSet) {
                    onions.alpha(opacity);
                    onions.image(frame.image);
                    opacity /= this.onionsAlphaDivisor;
                }
            }

            return onionFrames;
        },
    
        viewport: (() => {
            const transformValues = {
                perspective: 0,
                translate: [0, 0],
                scale: [1, 1],
                rotate: [0],
                skew: [0, 0],
            };
    
            function styleLayers() {
                const transform =
                    `perspective(${transformValues.perspective}px) ` +
                    `translate(${transformValues.translate.join("px,")}px) ` +
                    `scale(${transformValues.scale.join()}) ` +
                    `rotate(${transformValues.rotate}deg) ` +
                    `skew(${transformValues.skew.join("deg,")}deg)`;
    
                for (let e of qsa(".transformed-viewport")) {
                    e.style.transform = transform;
                }
            }
    
            function notNaN(n) {
                return typeof n === "number" && !isNaN(n);
            }
    
            const viewport = {
                get perspective() {
                    return Array.from(transformValues.perspective);
                },

                get translate() {
                    return Array.from(transformValues.translate);
                },
                get scale() {
                    return Array.from(transformValues.scale);
                },
                get rotate() {
                    return Array.from(transformValues.rotate);
                },
                get skew() {
                    return Array.from(transformValues.skew);
                },

                get translateNegation() {
                    return transformValues.translate.map(num => -num);
                },
                get scaleNegation() {
                    return transformValues.scale.map(num => 1 / num);
                },
                get rotateNegation() {
                    return transformValues.rotate.map(num => -num * Math.PI / 180);
                },
                get skewNegation() {
                    return transformValues.skew.map(num => -num * Math.PI / 180);
                },

                transform(...transforms) {
                    for (let transform of transforms) {
                        if (transform.length <= 1) continue;

                        const target = transformValues[transform[0]];

                        for (let i = 1; i < transform.length; i++) {
                            const n = transform[i];
                            if (notNaN(n)) {
                                target[i - 1] = n;
                            }
                        }

                        styleLayers();
                    }
                },
            };

            return viewport;
        })(),
    };
})();

// Page layout setup //////////////////////////////////////////////////////////

onresize = resetDrawer;

addEventListener("beforeunload", event => {
    event.returnValue = "\u0000";
}, false);


// Layout functions ///////////////////////////////////////////////////////////

function resetDrawer() {
    drawer.width(drawingZone.width)
        .height(drawingZone.height);

    restyleDrawer();
}

function restyleDrawer() {
    drawer.cap("round")
        .joint("round")
        .strokeWidth(settings.strokeWidth)
        .style(settings.getGCOColor());
}


// Function functions /////////////////////////////////////////////////////////

async function resizeCanvas(width, height, x=0, y=0) {
    width = valuecheck(width, { min: 1, integer: true });
    height = valuecheck(height, { min: 1, integer: true });

    for (let canvas of [...Layer.allCanvases(), onions]) {
        canvas.width(width).height(height);
    }

    for (let e of [layersContainer, drawerBG]) {
        e.style.width = `${width}px`;
        e.style.height = `${height}px`;
    }

    if (x || y) {
        x = valuecheck(x, { integer: true });
        y = valuecheck(y, { integer: true });

        const buffer = new Canvas(width, height);
        for (let frame of Layer.allFrames()) {
            buffer.image(frame.image, -x, -y);
            frame.src = buffer.toSrc();
            buffer.clear();
        }
    }
    
    if (settings.width !== width) settings.width = width;
    if (settings.height !== height) settings.height = height;

    Layer.refreshAllCanvases();
    //for (let frame of Layer.allFrames()) {
    //    timeline.reimageFrame(frame);
    //}
}

function last(array) {
    return array[array.length - 1];
}

function newImage(src, onload) {
    const image = new Image();

    if (onload) {
        image.addEventListener("load", event => {
            onload(image, event);
        }, { once: true });
    }

    image.src = src;
    return image;
}

function showZone(zoneName) {
    let toBeHidden = [];
    let toBeShown = [];

    switch (zoneName) {
        case "timeline":
        case "settings":
            toBeHidden = ["files"];
            toBeShown = ["timeline", "settings"];
            break;
        
        case "files":
            toBeHidden = ["timeline", "settings"];
            toBeShown = ["files"];
            break;
    }

    for (let zone of toBeHidden) {
        getZone(zone).classList.add("hidden");
    }
    for (let zone of toBeShown) {
        getZone(zone).classList.remove("hidden");
    }

    function getZone(zoneName) {
        return qs(`${zoneName}-zone`);
    }
}

App.copyProperties({
    mod(a, b) {
        return (a % b + b) % b;
    },
});

function getElementRelativeCoords(mouseEvent, target, method=0) {
    if (!target) target = mouseEvent.currentTarget;

    let x;
    let y;

    let left;
    let top;

    switch (method) {
        // Method 0: Use `getClientBoundingRect`: accurate with relative positioning, but not accurate when CSS
        // transforms are applied.
        default:
        case 0: {
            let rect = target.getBoundingClientRect();

            left = rect.left;
            top = rect.top;
            break;
        }

        // Method 1: Use offset properties: still accurate when CSS transforms applied, but zeroed with relative
        // positioning
        case 1:
            left = target.offsetLeft;
            top = target.offsetTop;
            break;
    }

    x = mouseEvent.x - left;
    y = mouseEvent.y - top;

    return { x, y };
}

function reenterFrameBounds(frame) {
    if (view.layerid !== frame.layer.id) {
        view.layerid = frame.layer.id;
    }

    if (view.ms < frame.start || view.ms >= frame.end) {
        view.ms = frame.start;
        timeline.updateFrameInputs();
    }
}

/* valuecheck options properties:
 * 
 * percentageRatio - ratio by which, if the value is a percentage "n%", this value will be multiplied - default 100
 * min - lowest possible value, inclusive
 * max - highest possible value, inclusive
 * integer - whether to floor the value
 * number - whether not to allow NaNs
 * nan - default value to use in the case of NaN - default min or 0
 * finite - whether not to allow Infinitys
 * infinity - default value to use in the case of Infinity - default 0
 */

const valuecheck = (function () {
    /**
     * @function valuecheck
     * @param {(number|string)} value The value to be checked.
     * @param {Object} [options] Restrictions or default values used when checking the value.
     * @param {number} [options.percentageRatio=100] The ratio by which, if the value is a string of the form `"<n>%"`, 
     *     `n` will be multiplied.
     * @param {number} [options.min] The lowest possible value, inclusive.
     * @param {number} [options.max] The greatest possible value, inclusive.
     * @param {boolean} [options.integer=false] Whether to floor the value.
     * @param {boolean} [options.number=true] Whether to allow `NaN` as a final result.
     * @param {number} [options.nan=options.min || 0] The value to use in the case of an `NaN`, if `options.number` 
     *     is true.
     * @param {boolean} [options.finite=true] Whether to allow an infinite value as a final result.
     * @param {number} [options.infinity=0] The value to use in the case of an infinite value, if `options.finite` 
     *     is true.
     * @returns {number} The validated value.
     */
    function valuecheck(value, options={}) {
        if (isPercentage(value)) {
            if (isNaN(options.percentageRatio)) options.percentageRatio = 100;
            value = trimlast(value) / options.percentageRatio;
        } else if (typeof value === "string") {
            value = parseFloat(value);
        }
        value = Number(value);

        if (options.min !== undefined) value = Math.max(value, options.min);
        if (options.max !== undefined) value = Math.min(value, options.max);
        if (options.integer)           value = Math.floor(value);

        if (isN(value) || !ifDefined(options.number, true)) value = value;
        else if (isN(options.nan)) value = options.nan;
        else if (isN(options.min)) value = options.min;
        else value = 0;

        if (isFinite(value) || !ifDefined(options.finite, true)) value = value;
        else if (isN(options.infinity)) value = options.infinity;
        else value = 0;

        return value;
    }

    function isN(value) {
        return !isNaN(value);
    }

    function ifDefined(value, newvalue) {
        return value === undefined ? newvalue : value;
    }

    function isDefined(...values) {
        for (let v of values) {
            if (v !== undefined) {
                return true;
            }
        }
        return false;
    }

    function isPercentage(string) {
        return typeof string === "string" && string.endsWith("%");
    }

    function trimlast(string) {
        return string.substring(0, string.length - 1);
    }

    return valuecheck;
})();

function reenterFrameBounds(frame) {
    if (view.layerid !== frame.layer.id) {
        view.layerid = frame.layer.id;
    }

    if (view.ms < frame.start || view.ms >= frame.end) {
        view.ms = frame.start;
        timeline.updateFrameInputs();
    }
}