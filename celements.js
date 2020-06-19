"use strict";

class DrawingZone extends HTMLElement {
    constructor() {
        super();

        this.computedStyle = getComputedStyle(this);
    }

    get width() {
        return parseInt(this.computedStyle.width);
    }
    get height() {
        return parseInt(this.computedStyle.height);
    }
}
customElements.define("drawing-zone", DrawingZone);

class TimelineZone extends HTMLElement {
    constructor() {
        super();
    }
}
customElements.define("timeline-zone", TimelineZone);

class SettingsZone extends HTMLElement {
    constructor() {
        super();
    }
}
customElements.define("settings-zone", SettingsZone);

class FilesZone extends HTMLElement {
    constructor() {
        super();
    }
}
customElements.define("files-zone", FilesZone);

const FrameHandle = (() => {
    const members = [
        createElement("frame-handle", ["class", "left"]),
        createElement("frame-handle", ["class", "right"]),
        createElement("frame-handle", ["class", "center"]),
    ];
    let relativeFrameX;

    function dragger(event) {
        FrameHandle.draggedHandle = event.currentTarget;
        timeline.element.removeEventListener("mousemove", event => {
            timeline.attachFrameHandles(event);
        }, false);

        if (FrameHandle.draggedHandle === members[2]) {
            relativeFrameX = getElementRelativeCoords(event, FrameHandle.attachedFrame.timelineElement).x;
        }
    }

    addEventListener("mouseup", event => {
        if (!FrameHandle.draggedHandle) return;

        const frame = FrameHandle.attachedFrame;
        
        const relative = getElementRelativeCoords(event, timeline.element);

        if (FrameHandle.draggedHandle === members[0]) {
            const oldStart = frame.start;
            const newStart = valuecheck(timeline.calculateMSAt(relative.x), { max: frame.end - 1 });
            const startDiff = oldStart - newStart;
            frame.start = newStart;
            frame.duration += startDiff;
        } else if (FrameHandle.draggedHandle === members[1]) {
            frame.end = timeline.calculateMSAt(relative.x);
        } else {
            frame.start = timeline.calculateMSAt(relative.x - relativeFrameX);

            frame.migrateToList(view.currentFrameList);
        }
        FrameHandle.draggedHandle = null;
        view.currentFrameList.arrange("back");
        view.currentLayer.refreshCanvas();

        timeline.element.addEventListener("mousemove", event => { timeline.attachFrameHandles(event); }, false);
    });

    function classFrame(value) {
        const frame = FrameHandle.attachedFrame;
        if (!FrameHandle.attachedFrame) return;

        const element = frame.timelineElement;
        element.classList.toggle("handles-attached", value);
    }

    class FrameHandle extends HTMLElement {
        constructor() {
            super();

            this.hidden = true;
            this.dragging = false;
            this.addEventListener("mousedown", dragger, false);
        }

        static attachAllToFrame(frame=view.currentFrame()) {
            classFrame(false);

            this.attachedFrame = frame;
            classFrame(true);

            for (let element of members) {
                frame.timelineElement.appendChild(element);
            }
        }

        static get hidden() {
            return members[0].hidden;
        }
        static set hidden(value) {
            classFrame(!value);

            for (let element of members) {
                element.hidden = value;
            }
        }

        get hidden() {
            return this.hasAttribute("hidden");
        }
        set hidden(value) {
            if (value) {
                this.setAttribute("hidden", "");
            } else {
                this.removeAttribute("hidden");
            }
        }
    }
    FrameHandle.attachedFrame = null;
    FrameHandle.draggedHandle = null;

    return FrameHandle;
})();
customElements.define("frame-handle", FrameHandle);

function createElement(tag, ...attributes) {
    const element = document.createElement(tag);

    for (let attr of attributes) {
        const value = attr[1] || "";

        if (attr[0] === "class") {
            element.classList.add(value);
        } else {
            element.setAttribute(attr[0], value);
        }
    }

    return element;
}