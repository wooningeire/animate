"use strict";

const App = {
    copyProperties(object) {
        for (let [key, value] of Object.entries(object)) {
            this[key] = value;
        }
    },
};

const Layer = (() => {
    const map = new WeakMap();
    const _ = key => map.get(key);

    class Layer {
        /**
         * Represents a drawing layer.
         * @returns {Layer}
         */
        constructor() {
            map.set(this, {});

            this.assignList(new FrameList()); // Claim ownership over a new FrameList (useful for timeline)
            this.assignList(new TransitionList());
            this.assignList(new CopyList());

            this.canvas = new Canvas();

            this.timelineElement = null;

            this.hidden = false;

            this.alpha = 255;
            this.perspective = 0;
            this.originX = 0;
            this.originY = 0;
            this.originZ = 0;
            this.translateX = 0;
            this.translateY = 0;
            this.translateZ = 0;
            this.rotateX = 0;
            this.rotateY = 0;
            this.rotateZ = 1;
            this.rotateA = 0;
            this.scaleX = 1;
            this.scaleY = 1;
            this.scaleZ = 1;
            this.skewX = 0;
            this.skewY = 0;

            this.blending = "source-over";

            this.canEndPrematurely = false;
        }

        static add(index=0, initFrame=false) {
            const newLayer = new Layer();

            // add to timeline
            timeline.addLayer(newLayer);

            this.layers.splice(index, 0, newLayer);
            layersContainer.insertBefore(newLayer.canvas.canvas, layersContainer.children[index]);
            view.layerid = index;

            // add starter frame
            if (initFrame) {
                newLayer.frames.add({ start: view.ms });
            }

            /* debug
            newLayer.canvas.canvas.setAttribute("data-index", newLayer.id);
            newLayer.timelineElement.setAttribute("data-index", newLayer.id);*/

            return newLayer;
        }

        static insert(layer, index) {
            timeline.addLayer(layer);

            this.layers.splice(index, 0, layer);
            layersContainer.insertBefore(layer.canvas.canvas, layersContainer.children[index]);
            view.layerid = index;

            timeline.addMissingFrames(layer);

            return layer;
        }

        static swap(index0, index1) {
            [this.layers[index0], this.layers[index1]] = [this.layers[index1], this.layers[index0]];

            timeline.rearrangeLayers();

            for (let { canvas } of Layer.allCanvases()) {
                layersContainer.appendChild(canvas);
            }

            return this.layers;
        }

        static allFrames() {
            const result = allFrameLists().flat();
            return result;
        }

        static allCanvases() {
            return this.layers.map(layer => layer.canvas);
        }

        static formSheet() {
            const frames = this.allFrames();
            const buffer = new Canvas(settings.width, settings.height * frames.length);

            for (let i = 0; i < frames.length; i++) {
                buffer.image(frames[i].image, 0, settings.height * i);
            }

            return buffer.toImage(image => document.body.appendChild(image));
        }

        static refreshAllCanvases() {
            for (let layer of this.layers) {
                layer.refreshCanvas(true);
            }
        }

        static async mergeAll(bgColor) {
            const lists = allFrameLists();

            let result = bgColor ? await this.createSolid(bgColor) : lists.shift();
            for (let list of lists) {
                result = await result.merge(list);
            }
            return result;
        }

        static async createSolid(bgColor) {
            const bgSrc = new Canvas().style(bgColor).cover().toSrc();

            const list = new FrameList();
            const frame = list.add({ start: 0, end: this.trueEnd, src: bgSrc });

            await imageLoad(frame.image);

            return list;
        }

        static get trueEnd() {
            return Math.max(...Layer.layers.map(layer => layer.canEndPrematurely ? 0 : layer.frames.end));
        }

        /*shallowClone() {
            const newLayer = new Layer();

            for (let frame of this.frames) {
                newLayer.frames.add(frame);
            }

            return newLayer;
        }*/

        delete() {
            if (view.layerid === Layer.layers.length - 1) {
                view.layerid--;
            }

            timeline.removeLayer(this);
            this.canvas.canvas.remove();

            Layer.layers.splice(this.id, 1);
        }

        /*emit(event) {

        }*/

        imageAt(ms=view.ms) {
            const frameImage = this.frames.imageAt(ms);
            const copyImage = this.copies.imageAt(ms);

            switch (true) {
                case frameImage.width === 0 && copyImage.width === 0:
                case frameImage.width !== 0:
                default:
                    return frameImage;
                
                case frameImage.width === 0 && copyImage.width !== 0:
                    return copyImage;
            }
        }

        refreshCanvas() {
            this.canvas.clear();

            const evaluate = property => this.transitions.evaluatePropertyAt(property);

            this.canvas.canvas.style.transformOrigin =
                `${evaluate("originX")}px ${evaluate("originY")}px`;

            this.canvas.canvas.style.transform =
                `perspective(${evaluate("perspective")}px) ` +
                `translate3d(${evaluate("translateX")}px, ${evaluate("translateY")}px, ${evaluate("translateZ")}px) ` +
                `rotate3d(${evaluate("rotateX")}, ${evaluate("rotateY")}, ${evaluate("rotateZ")}, ` +
                    `${evaluate("rotateA")}deg) ` +
                `scale3d(${evaluate("scaleX")}, ${evaluate("scaleY")}, ${evaluate("scaleZ")}) ` +
                `skew(${evaluate("skewX")}deg, ${evaluate("skewY")}deg)`;
            
            this.canvas.canvas.style.opacity = evaluate("alpha") / 255;

            /*
            this.canvas
                .resetTransform()
                .translate(evaluate("translateX"), evaluate("translateY"))
                .alpha(evaluate("alpha"));*/

            this.canvas.image(this.imageAt());

            return this;
        }

        toggle(force) {
            this.canvas.canvas.classList.toggle("hidden", force);

            return this;
        }

        assignList(list=new FrameList()) {
            if (list instanceof LayerObjectList) {
                // Disown existing list
                if (this[list.itemNamePlural]) {
                    if (list instanceof FrameList) {
                        timeline.wipeFrames(this);
                    }
                    this[list.itemNamePlural].layer = null;
                }

                // Set the list to the new one
                list.layer = this;
                this[list.itemNamePlural] = list;

                if (list instanceof FrameList) {
                    timeline.addMissingFrames(this);
                }
            } else {
                throw new TypeError(`${list.constructor.name} is not a valid list type`);
            }

            return list;
        }
        
        /**
         * Takes the content from this layer’s canvas and transfers it to the current frame’s `image`. If there is no
         *     current frame, a new one is created.
         * @param {*} options 
         */
        recordFrame(options={}) {
            const canvas = this.canvas;
    
            //const trim = canvas.trim();
            //canvas.canvas.style.left = `${trim.left}px`;
            //canvas.canvas.style.top = `${trim.top}px`;
    
            const layerImage = canvas.toImage();
    
            // If the painted frame already exists on the layer, update this frame.
    
            let frame = view.currentFrame();
    
            if (frame) {
                log.add(new FramePropertyEditedEntry(frame, ["src", frame.src, layerImage.src]));
                
                frame.src = layerImage.src;
                timeline.reimageFrame(frame);
                return;
            }
    
            // If the painted frame does not exist but is an inbetween, generate the inbetween frame and add it to the
            // current layer.
    
            frame = this.frames.fillBlanks().itemAt();
    
            if (frame) {
                if (frame.duration > settings.minOutlierDuration) {
                    this.frames.add(Object.assign({
                        start: Math.min(view.ms, frame.end - settings.defaultFrameDuration),
                        image: layerImage,
                    }, options));
                } else {
                    frame.src = layerImage.src;
        
                    const newFrame = this.frames.add(Object.assign(frame, options));
        
                    log.add(new FrameCreatedEntry(newFrame));
                }
            }
    
            // Otherwise, add the frame to the end of the layer.
    
            else { 
                const newFrame = this.frames.add(Object.assign({
                    start: view.ms,
                    image: layerImage,
                }, options));
    
                log.add(new FrameCreatedEntry(newFrame));
            }
    
            timeline.updateFrameInputs();
        }

        /**
         * Merges two layers. Unlike `FrameList.prototype.merge`, this method applies changes in-place.
         * @async
         * @param {Layer} secondaryLayer The layer whose frames will be merged with this one's.
         * @returns {Layer} This.
         */

        async merge(secondaryLayer) {
            const frames = await this.frames.merge(secondaryLayer.frames);
            this.assignList(frames);

            secondaryLayer.delete();

            return this;
        }

        // gett sett

        get id() {
            return Layer.layers.indexOf(this);
        }
        set id(newId) {
            newId = valuecheck({ integer: true, min: 0, max: Layer.layers.length - 1 });

            Layer.layers.splice(this.id, 1);
            Layer.layers.splice(newId, 0, this);

            timeline.rearrangeLayers();
        }

        get alpha() {
            return _(this).alpha;
        }
        set alpha(alpha) {
            _(this).alpha = valuecheck(alpha, { min: 0, max: 255, integer: true });
            
            this.canvas.alpha(_(this).alpha);
        }

        get blending() {
            return _(this).blending;
        }
        set blending(blending) {
            _(this).blending = blending;
            this.canvas.canvas.style.mixBlendMode = blending;
        }

        get trimming() {
            return this.frames.itemAt(view.ms, true).trimming;
        }
    }
    Layer.layers = [];

    class LayerObject {
        constructor(options={}) {
        }

        isAt(ms) {
            return this.start <= ms && ms < this.end;
        }

        isInRange(start, end) {
            return this.start < end && start < this.end;
        }

        remove() {
            if (!this.list) return false;

            this.list.remove(this);
            return true;
        }

        migrateToList(list) {
            if (list instanceof Layer) {
                list = list.frames;
            }
            
            if (list !== this.list) {
                this.remove();
                list.readd(this);
                return true;
            }
            return false;
        }

        get layer() {
            return this.list ? this.list.layer : null;
        }

        get index() {
            return this.list ? this.list.indexOf(this) : -1;
        }
    }

    class Frame extends LayerObject {
        /**
         * @param {Object} [options={}] An object with properties to initiate those of the new frame.
         * @param {number} [options.start=0] The start of the frame in ms.
         * @param {number} [options.duration=settings.defaultFrameDuration] The duration of the frame in ms.
         * @param {number} [options.end] The end of the frame in ms. Overrides `options.duration` if specified.
         * @param {string} [options.src=""] The src URL of the frame's image. Overrides `options.image` if specified.
         * @param {Image} [options.image=new Image()] The image element to use.
         */
        constructor(options={}) {
            super(options);

            map.set(this, {});

            this.start = options.start;
            this.duration = options.duration;
            if (options.end) this.end = options.end;

            this.image = !options.src ? options.image || new Image() : new Image();
            if (options.src) this.src = options.src;

            // These cannot default to zero; otherwise, the layer will always extend to the top-left corner on first
            // stroke.
            //this.x = NaN;
            //this.y = NaN;

            this.timelineElement = null;
            this.list = null;
        }

        link(frame) {
            if (typeof frame === "number") {
                frame = this.list[frame];
            }

            this.image = frame.image;
        }

        unlink() {
            const src = this.src;
            this.image = new Image();
            this.src = src;
        }

        exists() {
            return Boolean(this.list && this.list.layer);
        }

        getPrecedents(n) {
            if (n <= 0) return new FrameList();

            return this.list.slice(Math.max(this.index - n, 0), this.index);
        }

        getSuccedents(n) {
            if (n <= 0) return new FrameList();

            return this.list.slice(this.index + 1, this.index + n + 1);
        }

        /*setTrimming() {
            const canvas = new Canvas(this.image);
            const trimming = canvas.getTrimming();
            this.trimming = trimming;
        }*/

        get start() {
            return _(this).start;
        }
        set start(start) {
            _(this).start = valuecheck(start, { min: 0, integer: true });

            if (this.timelineElement) timeline.resizeFrames(this);
            if (this.list === view.currentFrameList) timeline.updateFrameInputs();
        }

        get duration() {
            return _(this).duration;
        }
        set duration(duration) {
            _(this).duration = valuecheck(duration, {
                min: 1,
                integer: true,
                finite: false,
                nan: settings.defaultFrameDuration,
            });

            if (this.timelineElement) timeline.resizeFrames(this);
            if (this.list === view.currentFrameList) timeline.updateFrameInputs();
        }

        get end() {
            return this.start + this.duration;
        }
        set end(end) {
            this.duration = end - this.start;
        }

        get src() {
            return this.image.src;
        }
        set src(src) {
            this.image.src = src;
        }

        get width() {
            return this.image.width;
        }

        get height() {
            return this.image.height;
        }

        get trimming() {
            return new TrimmingRect(this.x, this.y, this.width, this.height);
        }
    }

    class Transition extends LayerObject {
        constructor(options={}) {
            super(options);

            map.set(this, {});

            this.start = options.start;
            this.duration = options.duration;
            if (options.end) this.end = options.end;

            this.easingFunction = options.easingFunction || (t => t);
            this.property = options.property;
            this.targetValue = options.targetValue;

            this.list = null;
        }

        evaluateAtRaw(time) {
            if (isNaN(time) || time < 0 || time > 1) throw new RangeError(`${time} ms is out of bounds`);

            return this.easingFunction(time);
        }

        evaluateAt(ms=view.ms) {
            if (isNaN(ms)) throw new TypeError(`Invalid ms ${ms}`);
            
            const time = (ms - this.start) / this.duration;

            if (time <= 0) return 0;
            if (time >= 1) return 1;
            if (isNaN(time)) return 1; // isNaN(time) -> time === 0 / 0

            return valuecheck(this.evaluateAtRaw(time));
        }

        evaluateInContextAt(ms=view.ms) {
            if (isNaN(ms)) throw new TypeError(`Invalid ms ${ms}`);

            return this.evaluateAt(ms) * (this.targetValue - this.initialValue) + this.initialValue;
        }

        get start() {
            return _(this).start;
        }
        set start(start) {
            _(this).start = valuecheck(start, { min: 0, integer: true });
        }

        get duration() {
            return _(this).duration;
        }
        set duration(duration) {
            _(this).duration = valuecheck(duration, {
                min: 0,
                integer: true,
                finite: false,
                nan: settings.defaultFrameDuration,
            });
        }

        get end() {
            return this.start + this.duration;
        }
        set end(end) {
            this.duration = end - this.start;
        }

        get property() {
            return _(this).property;
        }
        set property(property) {
            if (!Transition.validProperties.includes(property)) {
                throw new RangeError(`"${property}" is not a valid property name`);
            }

            _(this).property = property;
        }

        get easingFunction() {
            return _(this).easingFunction;
        }
        set easingFunction(fnOrDegree) {
            if (!isNaN(fnOrDegree)) fnOrDegree = App.generatePolynomialEasingFunction(fnOrDegree);

            if (typeof fnOrDegree !== "function") throw new TypeError(`${fnOrDegree} is not a degree nor a function`);

            _(this).easingFunction = fnOrDegree;
        }

        get initialValue() {
            if (this.list) {
                return this.list.evaluatePropertyAt(this.property, this.start - 1);
            }
            return 0;
        }
    }
    Transition.validProperties = Object.freeze([
        "alpha", "perspective", "originX", "originY", "originZ", "translateX", "translateY", "translateZ", "rotateX",
        "rotateY", "rotateZ", "rotateA", "scaleX", "scaleY", "scaleZ", "skewX", "skewY",
    ]);

    class Copy extends LayerObject {
        constructor(options={}) {
            super(options);

            map.set(this, {});

            this.start = options.start;

            this.layer = options.layer || view.currentLayer;

            this.startIndex = options.startIndex;
            this.endIndex = options.endIndex;
        }

        get start() {
            return _(this).start;
        }
        set start(start) {
            _(this).start = valuecheck(start, { min: 0, integer: true });
        }

        get startIndex() {
            return _(this).startIndex;
        }
        set startIndex(index) {
            _(this).startIndex = valuecheck(index, { min: 0, integer: true });
        }

        get endIndex() {
            return _(this).endIndex;
        }
        set endIndex(index) {
            _(this).endIndex = valuecheck(index, { min: 0, integer: true });
        }

        get referenceList() {
            return _(this).referenceList || this.layer.frames;
        }
        set referenceList(list) {
            if (list instanceof CopyList) throw new TypeError("Copies may not refer to CopyLists");

            _(this).referenceList = list;
        }

        get duration() {
            return this.lastFrame.end - this.firstFrame.start;
        }

        get end() {
            return this.start + this.duration;
        }

        get targetItemsList() {
            const list = this.referenceList.slice(this.startIndex, this.endIndex);
            if (list[0]) list.offset = list[0].start;
            return list;
        }
        get firstFrame() {
            return this.referenceList[this.startIndex];
        }
        get lastFrame() {
            return this.referenceList[this.endIndex - 1];
        }

        get currentItem() {
            const ms = view.ms - this.start;
            if (ms < 0) return new this.listItemType();

            return this.targetItemsList.itemAt(ms, true);
        }

        get listItemType() {
            return this.referenceList.itemType;
        }
    }

    class LayerObjectList extends Array {
        constructor(offset=0) {
            super();

            map.set(this, {});

            this.offset = offset;
            this.layer = null;
        }

        /* static itemType = LayerObject */
        static get itemType() { return LayerObject; }
        static get itemNamePlural() { return "objects"; }

        itemAt(ms=view.ms) {
            ms += this.offset;
            if (ms < 0) return undefined;
            const item = this.find(item => item.isAt(ms));

            return item;
        }

        itemPreceding(ms=view.ms) {
            ms += this.offset;

            const item = this.itemAt(ms);

            if (item) return item;
            if (ms >= this.end) return last(this);

            for (let i = 0; i < this.length - 1; i++) {
                if (this[i].start <= ms && ms < this[i + 1].start) {
                    return this[i];
                }
            }
        }

        itemsInRange(start, end) {
            start += this.offset;
            end += this.offset;

            const results = [];

            for (let item of this) {
                if (item.isInRange(start, end)) results.push(item);
                if (item.start > end) break;
            }

            return results;
        }

        add(options, arrange=true) {
            const item = new this.itemType(options);
            item.list = this;

            this.push(item);
            if (arrange) this.arrange();

            return item;
        }

        readd(item, arrange=true) {
            this.push(item);
            item.list = this;
            if (arrange) LayerObjectList.prototype.arrange.call(this);

            return item;
        }

        arrange() {
            this.sort((a, b) => a.start - b.start);
            return this;
        }

        remove(index, amount=1) {
            if (index instanceof this.itemType) {
                index = index.index;
            }

            const splice = this.splice(index, amount);
            
            return splice;
        }

        clear() {
            this.length = 0;
        }

        get offset() {
            return _(this).offset;
        }
        set offset(offset) {
            _(this).offset = valuecheck(offset, { integer: true });
        }

        get start() {
            return this[0] ? this[0].start : 0;
        }

        get duration() {
            return this.end - this.start;
        }

        get end() {
            return last(this) ? last(this).end : 0;
        }

        get itemType() {
            return this.constructor.itemType;
        }

        get itemNamePlural() {
            return this.constructor.itemNamePlural;
        }

        get hasTimelineElement() {
            if (!this.layer || !this.layer.timelineElement) return false;

            return true;
        }
    }

    class FrameList extends LayerObjectList {
        /**
         * Array of frames that uses premade finding and sorting methods.
         * @param {...Frame} [items] Frames to add to the list at first.
         * @returns {FrameList}
         */
        constructor(...items) {
            super();

            for (let item of items) {
                this.push(item);
            }
        }

        static get itemType() { return Frame; }
        static get itemNamePlural() { return "frames"; }

        /**
         * Gets the frame at the specified time.
         * @param {number} [ms=view.ms] The time at which to search.
         * @param {boolean} [allowUnreal=false] Whether to include nonexistant frames in the search.
         * @returns {(Frame|undefined)} The frame.
         */
        itemAt(ms=view.ms, allowUnreal=false) {
            const frame = super.itemAt.call(this, ms);

            if (frame || !allowUnreal) {
                return frame;
            }

            return this.fillBlanks(Infinity).itemAt(ms);
        }

        /**
         * Gets the frames within the specified time range.
         * @param {number} start The lower bound of the time range.
         * @param {number} end The upper bound of the time range.
         * @param {boolean} [allowUnreal=false] Whether to include nonexistant frames in the search.
         * @returns {Frame[]} The array of frames.
         */
        itemsInRange(start, end, allowUnreal=false) {
            const list = allowUnreal ? this.fillBlanks(Infinity) : this;

            const results = super.itemsInRange.call(list, start, end);
            return results;
        }

        imageAt(ms=view.ms) {
            const frame = this.itemAt(ms);

            if (frame) {
                return frame.image;
            }
            return new Image();
        }

        /**
         * Constructs a new frame and adds it to the frame list.
         * @param {Object} [options] Properties to be applied to the frame upon creation.
         * @param {boolean} [arrange=true] Whether to arrange the frames after pushing the new one. Set to false if 
         *     many frames are to be added.
         * @returns {Frame} The new frame.
         */
        add(options, arrange=true) {
            // Defer arranging until after the new timeline element's creation.
            const frame = super.add.call(this, options, false);

            if (this.hasTimelineElement) {
                timeline.addFrame(frame);
                view.updateOnions();
                timeline.updateFrameInputs();
            }

            if (arrange) this.arrange();

            return frame;
        }

        /**
         * Adds a frame to the frame list without creating a new object or updating its element.
         * @param {Frame} frame The frame to add.
         * @param {boolean} [arrange=true] Whether to arrange the frames after pushing the new one. Set to false if 
         *     many frames are to be added.
         * @returns {Frame} The frame.
         */
        readd(frame, arrange) {
            super.readd.call(this, frame, arrange);

            if (this.hasTimelineElement) this.layer.refreshCanvas();

            return frame;
        }

        /**
         * Removes a frame from the frame list.
         * @param {(number|Frame)} index The frame to remove or its index.
         * @returns {Frame} The removed frame.
         */
        remove(index, amount) {
            const removedFrames = super.remove.call(this, index, amount);
            
            if (this.hasTimelineElement) {
                for (let frame of removedFrames) {
                    timeline.removeFrame(frame);
                }
                this.layer.refreshCanvas();
            }

            return removedFrames;
        }

        /**
         * Creates a new FrameList that contains empty and nonexistent inbetween frames.
         * @param {number} [forcedEnd] The minimum end of the final frame.
         * @param {boolean} [cloneFrames] Whether to construct new frames to push to the list so that existent frames 
         *     are bound to this FrameList rather than their originals.
         * @returns {FrameList} The new FrameList.
         */
        fillBlanks(forcedEnd, cloneFrames) {
            const clone = new FrameList();

            for (let frame of this) {
                const pastFrame = last(clone);
                const pastFrameEnd = pastFrame ? pastFrame.end : 0;

                if (/*!pastFrame && */frame.start !== pastFrameEnd) {
                    clone.add({ start: pastFrameEnd, end: frame.start });
                }

                if (cloneFrames) clone.add(frame);
                else clone.push(frame);
            }

            if (forcedEnd > clone.end) {
                clone.add({ start: clone.end, end: forcedEnd });
            }

            return clone;
        }

        clearBlanks() {
            for (let frame of this) {
                if (frame.src === "") frame.remove();
            }

            return this;
        }

        /**
         * Creates a new `FrameList` that contains all the frames of this list.
         * @returns {FrameList} The new FrameList.
         */
        shallowClone() {
            return new FrameList(...this);
        }

        /**
         * Rearranges this list's frames in order of increasing start.
         * @param {(boolean|string)} [redurationMethod=false] Whether to change the frames' durations as to prevent 
         *     overlapping. false for no reduration, "back" for back priority, "front" for front priority.
         * @returns {FrameList} This.
         */
        arrange(redurationMethod=false) {
            super.arrange.call(this);

            switch (redurationMethod) {
                default:
                case "back":
                    for (let i = 1; i < this.length; i++) {
                        if (this[i - 1].end > this[i].start) {
                            this[i - 1].end = this[i].start;
                        }
                    }
                    break;

                case "front":
                    for (let i = 1; i < this.length; i++) {
                        if (this[i].start < this[i - 1].end) {
                            this[i].start = this[i - 1].end;
                        }
                    }
                    break;
            }

            if (this.hasTimelineElement) timeline.rearrangeFrames(this.layer);

            return this;
        }

        /**
         * Shift each frame's start in-place by some time.
         * @param {number} ms The time by which to shift.
         * @returns {FrameList} This.
         */
        bump(ms) {
            if (ms === 0 || isNaN(ms)) return this;

            const negative = ms < 0;

            for (let item of this) {
                const newStart = item.start + ms;

                if (negative && newStart + item.duation < 0) {
                    item.remove();
                } else if (negative && newStart < 0) {
                    item.start = 0;
                    item.duration -= newStart;
                } else {
                    item.start += ms;
                }
            }

            return this;
        }

        fuseConsecutiveDuplicates() {
            for (let i = 0; i < this.length - 1; i++) {
                if (this[i].end === this[i + 1].start && this[i].src === this[i + 1].src) {
                    this[i].end = this[i + 1].end;
                    this[i + 1].remove();

                    i--;
                }
            }

            return this;
        }
        
        clear() {
            if (this.layer) this.wipeFrames(this.layer);

            super.clear.call(this);
        }

        /**
         * Creates a new FrameList which contains frames from another list overlaid onto the current ones.
         * @async
         * @param {FrameList} secondaryList The list to merge with.
         * @returns {FrameList} The new FrameList.
         */
        async merge(secondaryList) {
            const end = Math.max(this.end, secondaryList.end);

            const primary = this.fillBlanks(end);
            const secondary = secondaryList.fillBlanks(end);

            const result = new FrameList();

            const buffer = new Canvas();

            for (let frame1 of primary) {
                let overlaps = secondary.itemsInRange(frame1.start, frame1.end);

                for (let frame2 of overlaps) {
                    buffer.clear();
                    buffer.image(frame1.image);
                    buffer.image(frame2.image);

                    if (Canvas.imageDataIsEmpty(buffer.toImageData().data)) continue;

                    const start = Math.max(frame1.start, frame2.start);
                    const end = Math.min(frame1.end, frame2.end);

                    result.add({
                        start,
                        end,
                        src: buffer.toSrc(),
                    });
                }
            }

            return result;
        }
    }

    class TransitionList extends LayerObjectList {
        static get itemType() { return Transition; }
        static get itemNamePlural() { return "transitions"; }

        itemOfPropertyAt(property, ms=view.ms) {
            if (this.length === 0) return;

            ms += this.offset;
            if (ms < 0) return undefined;
            const items = this.find(item => item.property === property && item.isAt(ms));

            return items;
        }

        itemOfPropertyPreceding(property, ms=view.ms) {
            if (this.length === 0) return;

            ms += this.offset;

            const item = this.itemOfPropertyAt(property, ms);

            if (item) return item;

            const list = this.extractPropertyMembers(property);
            if (list.length === 0) return undefined;
            if (ms >= last(list).end) return last(list);

            for (let i = 0; i < list.length - 1; i++) {
                if (list[i].start <= ms && ms < list[i + 1].start) {
                    return list[i];
                }
            }
        }

        itemsOfPropertyInRange(property, start, end) {
            start += this.offset;
            end += this.offset;

            const results = [];

            for (let item of this) {
                if (item.property === property && item.isInRange(start, end)) results.push(item);
                if (item.start > end) break;
            }

            return results;
        }

        evaluatePropertyAt(property, ms=view.ms) {
            const transition = this.itemOfPropertyPreceding(property, ms);
            
            if (transition) return transition.evaluateInContextAt(ms);
            if (this.layer) return this.layer[property];

            return 0;
        }

        extractPropertyMembers(property) {
            return this.itemsOfPropertyInRange(property, this.start, this.end);
        }

        applyToCanvasAt(canvas, ms=view.ms) {
            const evaluate = property => this.evaluatePropertyAt(property, ms);

            const originX = evaluate("originX");
            const originY = evaluate("originY");

            canvas.resetTransform()
                .translate(originX, originY)
                .skew(evaluate("skewX") * Math.PI / 180, evaluate("skewY") * Math.PI / 180)
                .scale(evaluate("scaleX"), evaluate("scaleY"))
                .rotate(evaluate("rotateA") * Math.PI / 180)
                .translate(evaluate("translateX"), evaluate("translateY"))
                .translate(-originX, -originY);
            
            return this;
        }

        async applyToFrameList(referenceFrameList, epsilon=1) {
            const result = new FrameList();

            const buffer = new Canvas(settings.width, settings.height);

            for (let ms = 0; ms < referenceFrameList.end; ms += epsilon) {
                this.applyToCanvasAt(buffer, ms);
                buffer.clear()
                    .image(referenceFrameList.imageAt(ms));

                if (settings.aliasingEnabled) buffer.alias();

                const overlappedFrames = referenceFrameList.itemsInRange(ms, ms + epsilon);

                for (let frame of overlappedFrames) {
                    const start = Math.max(ms, frame.start);
                    const end = Math.min(ms + epsilon, frame.end);

                    result.add({
                        start,
                        end,
                        image: buffer.toImage(),
                    }, false);
                }
            }

            result.clearBlanks()
                .fuseConsecutiveDuplicates();

            return result;
        }
    }

    class CopyList extends LayerObjectList {
        static get itemType() { return Copy; }
        static get itemNamePlural() { return "copies"; }

        itemOfTypeAt(itemType, ms=view.ms) {
            if (this.length === 0) return;

            ms += this.offset;
            if (ms < 0) return undefined;
            const item = this.find(item => item.listItemType === itemType && item.isAt(ms));

            return item;
        }

        imageAt(ms=view.ms) {
            const copy = this.itemOfTypeAt(Frame, ms);

            if (copy) {
                return copy.targetItemsList.itemAt(ms - copy.start).image || new Image();
            }
            return new Image();
        }
    }

    // Utility functions //

    function imageLoad(image) {
        return new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = reject;
        });
    }

    function allFrameLists() {
        return Layer.layers.map(layer => layer.frames);
    }

    // App //

    App.copyProperties({
        renderFrame(ms=view.ms, bgColor="transparent", imageMIME) {
            const buffer = new Canvas(settings.width, settings.height)
                .imageSmoothing(!settings.aliasingEnabled)
                .clear()
                .fillStyle(bgColor)
                .cover();

            for (let layer of Layer.layers) {
                if (layer.hidden) continue;

                layer.transitions.applyToCanvasAt(buffer, ms);
                buffer
                    .gco(layer.blending)
                    .alpha(layer.transitions.evaluatePropertyAt("alpha", ms))
                    .image(layer.imageAt(ms));
                
                if (settings.aliasingEnabled) {
                    buffer.alias();
                }
            }

            return buffer.toSrc(imageMIME);
        },

        collectFrames(callback, { epsilon=16, bgColor="#fff", imageMIME }={}) {
            let prevSrc = "";
            let prevDuration = 0;

            for (let ms = 0; ms < Layer.trueEnd; ms += epsilon) {
                const src = this.renderFrame(ms, bgColor, imageMIME);
                if (src === prevSrc) {
                    prevDuration += epsilon;
                    continue;
                }

                if (ms !== 0) {
                    callback({
                        src: prevSrc,
                        duration: prevDuration,
                    });
                }
                prevSrc = src;
                prevDuration = epsilon;
            }

            callback({
                src: prevSrc,
                duration: prevDuration,
            });
        },

        generatePolynomialEasingFunction(degree=1, accelerationMode="inout") {
            switch (accelerationMode) {
                case "in":
                    return t => t**degree;
                
                case "out":
                    return t => (-1)**(degree - 1) * (t - 1)**degree + 1;

                case "inout": 
                    return t => t < .5 ? 2**(degree - 1) * t**degree : (-2)**(degree - 1) * (t - 1)**degree + 1;

                default:
                    throw new RangeError(`${accelerationMode} is an invalid acceleration mode`);
            }
        },

        // Ensure that an easing function starts at 0 and ends at 1
        fixEasingFunction(easingFunction) {
            const yIntercept = easingFunction(0);
            const shiftedEasingFunction = isNaN(yIntercept) || !isFinite(yIntercept)
                ? easingFunction
                : t => easingFunction(t) - yIntercept;

            const endValue = shiftedEasingFunction(1);
            return isNaN(endValue) || !isFinite(endValue)
                ? shiftedEasingFunction
                : endValue !== 0
                    ? t => shiftedEasingFunction(t) / endValue
                    : t => shiftedEasingFunction(t) + t ** 4; // arbitrary degree (any will work)
        },

        calcBezier(x1, y1, x2, y2, t) {
            // https://en.wikipedia.org/wiki/Cubic_function#General_solution_to_the_cubic_equation_with_real_coefficients


            /*const a = 3*x1 - 3*x2 + 1;
            const b = -6*x1 + 3*x2;
            const c = 3*x1;
            const d = -a*t**3 - b*t**2 - c*t; console.log(a, b, c, d);

            const p = (3*a*c - b**2) / (3*a**2);
            const q = (2*b**3 - 9*a*b*c + 27*(a**2)*d) / (27*a**3);

            const rt = 2 * Math.sqrt(-p / 3) * Math.cos(1/3 * Math.acos(3*q / (2*p) * Math.sqrt(-3 / p)) - 2*Math.PI*0 / 3);

            const y = (3*y1 - 3*y2 + 1)*rt**3 + (-6*y1 + 3*y2)*rt**2 + (3*y1)*rt;

            return y;

            /*
            const disc0 = b**2 - 3*a*c;
            const disc1 = 2*b**3 - 9*a*b*c + 27*(a**2)*d;

            const con0 = Math.cbrt((disc1 + Math.sqrt(disc1**2 - 4*disc0**3)) / 2);
            const con1 = Math.cbrt((disc1 - Math.sqrt(disc1**2 - 4*disc0**3)) / 2);

            const x = -1 / (3*a) * (b + con0 + disc0 / con0);
            const y = (3*y1 - 3*y2 + 1)*x**3 + (-6*y1 + 3*y2)*x**2 + (3*y1)*x;

            return y;*/
        },
    });

    return Layer;
})();