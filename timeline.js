"use strict";

/*

LAYER SETUP:
ordered vertically, one per row
stacked
linked with corresponding layer

when LAYER CREATED:
append to timeline using .appendChild
add default frame to layer element

when LAYER REMOVED: (includes merging)
delete layer element using .remove()

when LAYER REARRANGED:
correctly sort each layer element using .insertBefore

when LAYER SELECTED:
dehighlight previous selected layer
highlight new selected layer

FRAME SETUP:
ordered horizontally
positioned absolutely
linked with corresponding frame
.style.left: (start / view.timelineZoomScale)
.style.width: (start / view.timelineZoomScale)

when FRAME CREATED:
append to layer element using .insertBefore

when FRAME REMOVED:
delete frame element using .remove()

when FRAME REARRANGED:
correctly sort each frame element using .insertBefore or .appendChild

when FRAME DURATION RECALCULATED:
reset css left to match (start / view.timelineZoomScale)
reset css width to match (duration / view.timelineZoomScale)

*/

const timeline = (() => {
    /// TIMELINE ///

    const timebar = qs(".timebar");
    const addLayerButton = qs(".add-layer-button");
    const removeLayerButton = qs(".remove-layer-button");
    const timelineClock = qs(".clock-input");

    const frameStart = qs(".frame-start");
    const frameDuration = qs(".frame-duration");
    const frameEnd = qs(".frame-end");

    let timelineActive = false;
    let timelineShiftActive = false;
    let prevPath = [];

    // Managing elements

    const timeline = {
        element: qs(".timeline"),

        addLayer(layer) {
            const element = createElement("div", ["class", "timeline-layer"]);
            layer.timelineElement = element;

            timeline.element.appendChild(element);

            setTimeout(() => {
                this.rearrangeLayers();
                this.resizeLayers();
            }, 0); // FIND ALTERNATE SOLUTION: does not run correctly outside of setTimeout
        },

        removeLayer(layer) {
            layer.timelineElement.remove();
        },

        rearrangeLayers() {
            for (let layer of Layer.layers) {
                timeline.element.insertBefore(layer.timelineElement, timeline.element.firstElementChild);
            }
        },

        resizeLayers() {
            for (let layer of Layer.layers) {
                //e.timelineElement.style.left = `${e.frames.start / view.timelineZoomScale}px`;
                //e.timelineElement.style.width = `${e.frames.duration / view.timelineZoomScale}px`;
                layer.timelineElement.style.width = `${Layer.trueEnd / view.timelineZoomScale}px`;
            }
        },

        wipeFrames(layer) {
            for (let frame of layer.frames) {
                this.removeFrame(frame);
            }
        },

        addMissingFrames(layer) {
            for (let frame of layer.frames) {
                if (!frame.timelineElement || frame.timelineElement.parentNode !== layer.timelineElement) {
                    this.addFrame(frame);
                }
            }

            timeline.rearrangeFrames(layer);
        },

        readdFrames(layer) {
            layer.timelineElement.innerHTML = "";
            
            for (let frame of layer.frames) {
                this.addFrame(frame);
            }
        },

        rearrangeFrames(layer) {
            for (let i = 0; i < layer.frames.length; i++) {
                const frame = layer.frames[i];
                layer.timelineElement.insertBefore(frame.timelineElement, layer.timelineElement.childNodes[i]);
            }
        },

        addFrame(frame) {
            const element = createElement("div", ["class", "frame"]);
            frame.timelineElement = element;

            this.resizeFrames(frame);
            this.reimageFrame(frame);

            this.resizeLayers();

            frame.list.layer.timelineElement.appendChild(element);
        },

        removeFrame(frame) {
            frame.timelineElement.remove();
        },

        resizeFrames(...frames) {
            if (frames.length === 0) frames = Layer.allFrames();

            for (let frame of frames) {
                frame.timelineElement.style.left = `${frame.start / view.timelineZoomScale}px`;
                frame.timelineElement.style.width = `${frame.duration / view.timelineZoomScale}px`;
            }
        },

        reimageFrame(frame) {
            frame.timelineElement.style.backgroundImage = `url("${frame.src}")`;
        },

        updateClock() {
            let string;
            if (Layer.trueEnd >= 1000) {
                string = view.ms.toString().padStart(4, "0");
            } else {
                string = view.ms.toString();
            }
            timelineClock.value = string;
        
            qs(".clock-display > .sec").textContent = string.slice(0, -3);
            qs(".clock-display > .mil").textContent = string.slice(-3);
        },

        moveTimebar: (() => {
            const opacity = (m, a, x) =>
                Math.min(Math.max(-1 / m * Math.abs(x - (-m + a) / 2) - (-m - a) / (2 * m), 0), 1);
        
            return function () {
                const left = view.ms / view.timelineZoomScale - timeline.element.scrollLeft + this.elementPaddingLeft;
        
                timebar.style.left = `${left}px`;
                timebar.style.background = `rgba(255, 255, 255, ${opacity(16, timeline.element.clientWidth, left)})`;
            };
        })(),

        updateFrameInputs() {
            const frame = view.currentFrame(true);
            
            const duration = isFinite(frame.duration)
                ? frame.duration
                : view.ms <= Layer.trueEnd
                    ? Layer.trueEnd - (last(view.currentFrameList)
                        ? last(view.currentFrameList).end
                        : 0)
                    : "infinite";
                
            const end = isFinite(frame.end)
                ? frame.end
                : view.ms <= Layer.trueEnd
                    ? Layer.trueEnd
                    : "when a tardigrade dies";

            frameStart.value = frame.start;
            frameDuration.value = duration;
            frameEnd.value = end;

            const disable = !frame.exists();

            frameStart.disabled = disable;
            frameDuration.disabled = disable;
            frameEnd.disabled = disable;
        },

        toggleCompressed(state) {
            this.element.classList.toggle("compressed", state);
        },

        calculateMSAt(relativeX) {
            return (this.element.scrollLeft + relativeX) * view.timelineZoomScale;
        },
        
        getHoveredLayerIndex(event) {
            for (let element of event.path) {
                if (element === this.element || element === document.documentElement) break;

                if (element.classList.contains("timeline-layer")) {
                    const index = Layer.layers.length - previousSiblings(element).length - 1;
                    return index;
                }
            }
            return view.layerid;
        },

        getHoveredLayer(event) {
            return Layer.layers[this.getHoveredLayerIndex(event)];
        },

        attachFrameHandles(event) {
            let frameInPath = false;

            if (timelineShiftActive && !FrameHandle.draggedHandle) {
                for (let element of event.path) {
                    if (element === timeline || element === document.documentElement) break;

                    if (!element.classList.contains("frame")) continue;

                    frameInPath = true;
                    if (element === FrameHandle.attachedFrame) break;
                    
                    const frame = this.getHoveredLayer(event).frames[previousSiblings(element).length];
                    FrameHandle.attachAllToFrame(frame);
                    FrameHandle.hidden = false;

                    break;
                }
            }
            if (!frameInPath && !FrameHandle.draggedHandle) {
                FrameHandle.hidden = true;
            }

            prevPath = event.path;
        },

        get elementPaddingLeft() {
            return parseInt(getComputedStyle(this.element).paddingLeft);
        }
    };

    // Controls

    timeline.element.addEventListener("mousedown", timelineClick, false);
    addEventListener("mousemove", timelineClick, false);

    addEventListener("mouseup", () => {
        timelineActive = false;
    }, false);

    function timelineClick(event) {
        if (event.buttons !== 1) {
            timelineActive = false;
            return;
        }

        const relative = getElementRelativeCoords(event, timeline.element);

        if (event.type === "mousedown" &&
            0 <= relative.x && relative.x <= timeline.element.clientWidth &&
            0 <= relative.y && relative.y <= timeline.element.clientHeight
        ) {
            timelineActive = true;
        }

        if (!timelineActive) return;

        getSelection().removeAllRanges();

        view.ms = timeline.calculateMSAt(relative.x - timeline.elementPaddingLeft);

        for (let element of event.path) {
            if (element === timeline.element || element === document.documentElement) break;

            if (element.classList.contains("timeline-layer")) {
                view.layerid = Layer.layers.length - previousSiblings(element).length - 1;
                break;
            }
        }
    }

    timeline.element.addEventListener("mousemove", event => { timeline.attachFrameHandles(event); }, false);
    timeline.element.addEventListener("wheel", rescaleTimeline, { passive: true });
    timeline.element.addEventListener("scroll", timeline.moveTimebar, { passive: true });

    addEventListener("keydown", event => {
        if (!event.shiftKey) return;

        event.preventDefault();

        timelineShiftActive = true;
        timeline.attachFrameHandles({ path: prevPath });
    }, false);
    addEventListener("keyup", event => {
        if (event.shiftKey) return;

        event.preventDefault();

        timelineShiftActive = false;
        FrameHandle.hidden = true;
    }, false);

    function rescaleTimeline(event) {
        if (!timelineShiftActive) return;

        if (event.deltaY > 0) view.timelineZoomScale *= 1.25;
        else if (event.deltaY < 0) view.timelineZoomScale /= 1.25;
    }

    timelineClock.addEventListener("input", event => {
        //const caretPos = event.currentTarget.selectionStart - (view.ms.toString().length < 4 ? 1 : 0);
        view.ms = timelineClock.value;
        timeline.updateClock();

        //event.target.setSelectionRange(caretPos, caretPos); // keep the caret in place when the input is edited
    }, false);

    addLayerButton.addEventListener("click", () => {
        const newLayer = Layer.add(view.layerid + 1);

        log.add(new LayerCreatedEntry(newLayer));
    }, false);

    removeLayerButton.addEventListener("click", () => {
        if (Layer.layers.length === 1) {
            console.warn("Cannot manually delete only existing layer.");
            return;
        }
        
        log.add(new LayerRemovedEntry(view.currentLayer));

        view.currentLayer.delete();
    }, false);


    /// SETTINGS ///

    frameStart.addEventListener("change", () => {
        const frame = view.currentFrame();
        const initialValue = frame.start; // frameStart.value has not been checked yet
        frame.start = frameStart.value;
        reenterFrameBounds(frame);

        log.add(new FramePropertyEditedEntry(frame, ["start", initialValue, frame.start]));
    }, false);

    frameDuration.addEventListener("change", () => {
        const frame = view.currentFrame();
        const initialValue = frame.duration;
        frame.duration = frameDuration.value;
        reenterFrameBounds(frame);

        log.add(new FramePropertyEditedEntry(frame, ["duration", initialValue, frame.duration]));
    }, false);

    frameEnd.addEventListener("change", () => {
        const frame = view.currentFrame();
        const initialValue = frame.end;
        frame.end = frameEnd.value;
        reenterFrameBounds(frame);

        log.add(new FramePropertyEditedEntry(frame, ["end", initialValue, frame.end]));
    }, false);

    qs(".frame-delete-button").addEventListener("click", () => {
        view.deleteCurrentFrame();
    }, false);

    // Utility functions //

    function previousSiblings(element) {
        const list = [];

        while (element.previousElementSibling) {
            list.unshift(element.previousElementSibling);
            element = element.previousElementSibling;
        }

        return list;
    }

    return timeline;
})();