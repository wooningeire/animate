"use strict";

class Log extends Array {
    constructor() {
        super();
    }

    undoPresent() {
        if (this.present === -1) return; //console.warn("Nothing to be undone.");
    
        this[this.present].undo();
    }

    redoPresent() {
        if (this.present === this.length - 1) return; //console.warn("Nothing to be redone.");
        
        this[this.present + 1].redo();
    }

    add(entry) {
        if (!(entry instanceof LogEntry)) {
            throw new TypeError(
                `Mate, I have no idea what this is, but whatever it is, I\u2019m pretty sure "${entry}" isn\u2019t ` +
                "a log entry."
            );
        }

        this.splice(this.present + 1, this.length - this.present, entry);
        
        if (this.length > this.lengthLimit) this.shift();
        this.present = entry.index;

        return entry;
    }

    clear() {
        this.length = 0;
        this.present = -1;
    }
}

class LogEntry {
    constructor(data) {
        this.data = data;
        this.grouped = false;
        //this.timestamp = Date.now();
    }

    undo() {
        if (this.index === -2) return;
        if (this.undone) throw new TypeError("Entry already undone.");
        log.present = this.index - 1;
    }

    redo() {
        if (this.index === -2) return;
        if (this.done) throw new TypeError("Entry already done.");
        log.present = this.index;
    }

    get index() {
        return this.grouped ? -2 : log.indexOf(this);
    }

    get undone() {
        return log.present < this.index || this.index === -1;
    }

    get done() {
        return log.present >= this.index;
    }
}

class FrameCreatedEntry extends LogEntry {
    constructor(frame, layer=frame.layer) {
        super({ frame, layer });
    }

    undo() {
        super.undo();
        this.data.frame.remove();
        timeline.updateFrameInputs();
    }

    redo() {
        super.redo();
        this.data.layer.frames.readd(this.data.frame);
    }
}

class FrameRemovedEntry extends LogEntry {
    constructor(frame, layer=frame.layer) {
        super({ frame, layer });
    }

    undo() {
        super.undo();
        this.data.layer.frames.readd(this.data.frame);
    }

    redo() {
        super.redo();
        this.data.frame.remove();
        timeline.updateFrameInputs();
    }
}

class FramePropertyEditedEntry extends LogEntry {
    // props[i] = [ propName, initialValue, newValue ]

    // handles strokes (propName === "image")
    constructor(frame, ...props) {
        props.forEach((prop, i) => {
            props[i] = {
                propName: prop[0],
                initialValue: prop[1],
                newValue: prop[2]    
            };
        });
        super({ frame, props });
    }

    undo() {
        super.undo();

        for (let prop of this.data.props) {
            this.data.frame[prop.propName] = prop.initialValue;
        }
        reenterFrameBounds(this.data.frame);
        setTimeout(() => { Layer.refreshAllCanvases(); }, 0);
        timeline.reimageFrame(this.data.frame);
    }

    redo() {
        super.redo();

        for (let prop of this.data.props) {
            this.data.frame[prop.propName] = prop.newValue;
        }
        reenterFrameBounds(this.data.frame);
        timeline.reimageFrame(this.data.frame);
    }
}

class LayerCreatedEntry extends LogEntry {
    constructor(layer, index=layer.id) {
        super({ layer, index });
    }

    undo() {
        super.undo();
        this.data.layer.delete();
    }

    redo() {
        super.redo();
        Layer.insert(this.data.layer, this.data.index);
    }
}

class LayerRemovedEntry extends LogEntry {
    constructor(layer, index=layer.id) {
        super({ layer, index });
    }

    undo() {
        super.undo();
        Layer.insert(this.data.layer, this.data.index);
    }

    redo() {
        super.redo();
        this.data.layer.delete();
    }
}

class LayersSwappedEntry extends LogEntry {
    constructor(layers) {
        super({ layers });
    }

    undo() {
        super.undo();
        Layer.swap(layers[0].id, layers[1].id);
    }

    redo() {
        super.redo();
        Layer.swap(layers[0].id, layers[1].id);
    }
}

class LayersMergedEntry extends LogEntry {
    constructor(mergers, result) {
        super({ mergers, result });
    }

    undo() {
        super.undo();

    }

    redo() {
        super.redo();

    }
}

class GroupEntry extends LogEntry {
    constructor(...entries) {
        for (let entry of entries) entry.grouped = true;
        super({ entries });
    }

    undo() {
        for (let entry of this.data.entries.reverse()) entry.undo();
    }

    redo() {
        for (let entry of this.data.entries) entry.redo();
    }
}

const log = new Log();
log.present = -1;
log.lengthLimit = 40;

addEventListener("keydown", async event => {
    if (textboxIsSelected()) return;

    event.preventDefault();

    if (event.ctrlKey) {
        if (event.key === "z") log.undoPresent();
        else if (event.key === "y") log.redoPresent();
    }

    else if (event.shiftKey) {
        if (event.key === "ArrowDown") {
            let mergers = [view.currentLayer, Layer.layers[view.layerid - 1]];
            let result = await mergers[0].merge(mergers[1]);
            //log.add(new LayersMergedEntry(mergers, result));
        }
        else if (event.key === "T") {
            let result = await view.currentTransitionList.applyToFrameList(view.currentFrameList, 16);
            view.currentLayer.assignList(result);

            view.currentTransitionList.clear();
        }
    }

    else {
        if (event.key === "ArrowDown") view.layerid -= 1;
        else if (event.key === "ArrowUp") view.layerid += 1;
        else if (event.key === "ArrowLeft") view.framePrev();
        else if (event.key === "ArrowRight") view.frameNext();

        else if (event.key === "Delete") view.deleteCurrentFrame();
    }
}, false);

function textboxIsSelected() {
    const element = document.activeElement;
    const tag = element.tagName.toLowerCase();

    switch (tag) {
        case "textarea":
            if (element.disabled) return false;
            return true;
        
        case "input":
            if (element.disabled) return false;
            if ([
                "text", "number", "password", "email", "search", "tel", "url", "date", "datetime-local", "month",
                "week", "time", "range"
            ].includes(element.type)) {
                return true;
            }
            return false;

        default:
            if (element.isContentEditable) return true;
            return false;
    }
}