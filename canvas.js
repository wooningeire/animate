"use strict";

const [Canvas, TrimmingRect] = (() => {
    /**
     * Wraps a canvas to add more convenient methods.
     * @class
     */
    class Canvas {
        /**
         * @param {*} [args] If HTMLCanvasElement, the canvas element to be wrapped; if number or void, the (width, 
         *     height) of the new canvas [default (settings.width, settings.height)]; or otherwise, the item to 
         *     resolve to the canvas.
         * @returns {Canvas} The new wrapper.
         */  
        constructor(...args) {
            if (args[0] instanceof Canvas) {
                return args[0];
            }

            else if (args[0] instanceof Image) {
                return new Canvas(args[0].width, args[0].height)
                    .image(args[0]);
            }

            else if (typeof args[0] === "string") {
                return new Canvas(qs(args[0]));
            }

            // Create a canvas object out of a canvas element
            else if (args[0] instanceof HTMLCanvasElement) {
                this.canvas = args[0];
                this.context = args[0].getContext("2d");
            }

            // Create a new canvas element with given dimensions
            else {
                this.canvas = createElement("canvas");
                this.context = this.canvas.getContext("2d");

                args[0] = valuecheck(args[0], { nan: settings.width, min: 1 });
                args[1] = valuecheck(args[1], { nan: settings.height, min: 1 });

                this.width(args[0]).height(args[1]);
            }
        }

        /**
         * Tests if the data of an ImageData is fully transparent.
         * @param {Array} arr The ImageData's data array.
         * @returns {boolean}
         */
        static imageDataIsEmpty(arr) {
            let r = true;
            for (let i = 3; i < arr.length; i += 4) {
                if (arr[i] !== 0) {
                    r = false;
                    break;
                }
            }
            return r;
        }


        // Gett sett

        /**
         * Gets or sets the width of the canvas.
         * @param {(number|void)} [width=1] The number to which the canvas's width should be set. Void to return the 
         *     current width.
         * @returns {(Canvas|number)}
         */
        width(width) {
            if (width === undefined) return this.canvas.width;

            this.canvas.width = valuecheck(width, { min: 1, integer: true });
            return this;
        }

        /**
         * Gets or sets the height of the canvas.
         * @param {(number|void)} [height=1] The number to which the canvas's height should be set. Void to return the 
         *     current height.
         * @returns {(Canvas|number)}
         */
        height(height) {
            if (height === undefined) return this.canvas.height;

            this.canvas.height = valuecheck(height, { min: 1, integer: true });
            return this;
        }

        /**
         * Gets or sets the fillStyle of the canvas.
         * @param {(string|CanvasGradient|CanvasPattern|void)} [fillStyle] The style to which the canvas's fillStyle 
         *     should be set. Void to return the current fillStyle.
         * @returns {(Canvas|string|CanvasGradient|CanvasPattern)}
         */
        fillStyle(fillStyle) {
            if (fillStyle === undefined) return this.context.fillStyle;

            this.context.fillStyle = fillStyle;
            return this;
        }

        /**
         * Gets or sets the strokeStyle of the canvas.
         * @param {(string|CanvasGradient|CanvasPattern|void)} [strokeStyle] The style to which the canvas's 
         *     strokeStyle should be set. Void to return the current strokeStyle.
         * @returns {(Canvas|string|CanvasGradient|CanvasPattern)}
         */
        strokeStyle(strokeStyle) {
            if (strokeStyle === undefined) return this.context.strokeStyle;

            this.context.strokeStyle = strokeStyle;
            return this;
        }

        /**
         * Sets both the fillStyle and strokeStyle of the canvas or gets the strokeStyle.
         * @param {(string|CanvasGradient|CanvasPattern|void)} [style] The style to which the canvas's fillStyle and 
         *     strokeStyle should be set. Void to return the current strokeStyle.
         * @returns {(Canvas|string|CanvasGradient|CanvasPattern)}
         */
        style(style) {
            if (style === undefined) return this.context.strokeStyle;

            this.fillStyle(style).strokeStyle(style);
            return this;
        }

        /**
         * Gets or sets the lineCap of the canvas.
         * @param {(string|void)} [cap] The value to which the canvas's lineCap should be set. Void to return the 
         *     current lineCap.
         * @returns {(Canvas|string)}
         */
        cap(cap) {
            if (cap === undefined) return this.context.lineCap;

            this.context.lineCap = cap;
            return this;
        }

        /**
         * Gets or sets the lineJoin of the canvas.
         * @param {(string|void)} [joint] The value to which the canvas's lineJoin should be set. Void to return the 
         *     current lineJoin.
         * @returns {(Canvas|string)}
         */
        joint(joint) {
            if (joint === undefined) return this.context.lineJoin;

            this.context.lineJoin = joint;
            return this;
        }

        /**
         * Gets or sets the lineWidth of the canvas.
         * @param {(number|void)} [width] The size to which the canvas's lineWidth should be set. Void to return the 
         *     current lineWidth.
         * @returns {(Canvas|number)}
         */
        strokeWidth(width) {
            if (width === undefined) return this.context.lineWidth;

            this.context.lineWidth = width;
            return this;
        }

        /**
         * Gets or sets the globalCompositeOperation of the canvas.
         * @param {(string|void)} [joint] The value to which the canvas's globalCompositeOperation should be set. Void 
         *     to return the current globalCompositeOperation.
         * @returns {(Canvas|string)}
         */
        gco(gco) {
            if (gco === undefined) return this.context.globalCompositeOperation;
            
            this.context.globalCompositeOperation = gco;
            return this;
        }

        /**
         * Gets or sets the globalAlpha of the canvas.
         * @param {(number|void)} [joint] The alpha inclusively between 0 and 255 to which the canvas's globalAlpha 
         *     should be set. Void to return the current globalAlpha.
         * @returns {(Canvas|number)}
         */
        alpha(alpha) {
            if (alpha === undefined) return this.context.globalAlpha;

            this.context.globalAlpha = alpha / 255;
            return this;
        }

        /**
         * Sets the canvas's dimensions and style settings to those defined by the `settings` object.
         * @returns {Canvas}
         */
        matchSettings() {
            this.matchDims()
                .matchStyle();

            return this;
        }

        /**
         * Sets the canvas's dimensions to those defined by the `settings` object.
         * @returns {Canvas}
         */
        matchDims() {
            this.width(settings.width)
                .height(settings.height);

            return this;
        }

        /**
         * Sets the canvas's style settings to those defined by the `settings` object.
         * @returns {Canvas}
         */
        matchStyle() {
            this.style(settings.color)
                .strokeWidth(settings.strokeWidth)
                .cap(settings.cap)
                .joint(settings.joint);

            return this;
        }

        /**
         * Calculates the offset and dimensions of the smallest possible rectangle that can contain all nontransparent 
         *     content on the canvas.
         * @async
         * @returns {TrimmingRect}
         */
        async getTrimming() { // for cutting the transparent edges off the canvas and downsizing it
            for (let top = 0; this.rowIsTransparent(top); top++);
        
            let left;
            let width;
            let height;
            if (top === this.height()) { // ...then the entire image is empty. No need to iterate.
                top = NaN;
                left = NaN;
                width = 0;
                height = 0;
            } else {
                for (let bottom = this.height(); this.rowIsTransparent(bottom - 1); bottom--);
                for (left = 0; this.colIsTransparent(left); left++);
                for (let right = this.width(); this.colIsTransparent(right - 1); right--);

                height = bottom - top;
                width = right - left;
            }

            return new TrimmingRect(left, top, width, height);
        }

        /**
         * Gives an array containing two starting zeroes and the canvas's dimensions, intended to be spread onto a 
         *     context method used to cover the entire canvas.
         * @returns {Array}
         */
        dims() {
            return [0, 0, this.width(), this.height()];
        }


        // Instant figure drawers

        /**
         * Begins a new path and constructs a circle on the canvas.
         * @param {number} x Horizontal offset of the center of the circle.
         * @param {number} y Vertical offset of the center of the circle.
         * @param {number} r Distance of each point from the center of the circle.
         * @returns {Canvas}
         */
        instCircle(x, y, r) {
            this.context.beginPath();
            this.context.arc(x, y, r, 0, 2 * Math.PI);
            this.context.stroke();
            return this;
        }

        /**
         * Begins a new path and constructs a segment on the canvas.
         * @param {number} x1 Horizontal offset of the first endpoint of the segment.
         * @param {number} y1 Vertical offset of the first endpoint of the segment.
         * @param {number} x2 Horizontal offset of the second endpoint of the segment.
         * @param {number} y2 Vertical offset of the second endpoint of the segment.
         * @returns {Canvas}
         */
        instLine(x1, y1, x2, y2) {
            this.context.beginPath();
            this.context.moveTo(x1, y1);
            this.context.lineTo(x2, y2);
            this.context.stroke();
            return this;
        }


        // Path contiuation drawers (Assumes path is started already)

        /**
         * Constructs a quadratic beziér curve on the canvas, continuing the already begun path.
         * @param {number} x1 Horizontal offset of the first endpoint of the quadratic curve.
         * @param {number} y1 Vertical offset of the first endpoint of the quadratic curve.
         * @param {number} x2 Horizontal offset of the second endpoint of the quadratic curve.
         * @param {number} y2 Vertical offset of the second endpoint of the quadratic curve.
         * @returns {Canvas}
         */
        qCurve(x1, y1, x2, y2) {
            const midpoint = quadraticMidpoint(x1, y1, x2, y2);

            this.context.quadraticCurveTo(x1, y1, midpoint.x, midpoint.y);

            return this;
        }

        
        // Full path drawers

        /**
         * Begins a new path and constructs a set of quadratic beziér curves on the canvas using a given set of points.
         * @param {Point[]} points List of path points.
         * @returns {Canvas}
         */
        qCurvePath(points) {
            this.context.beginPath();
            this.context.moveTo(...points[0]);

            for (let i = 1; i < points.length - 1; i++) {
                const [p1, p2] = [points[i], points[i + 1]];

                this.qCurve(...p1, ...p2);

                /*/ Connecting with nearby points
                for (let j = 0; j < i; j++) {
                    const dist = Math.sqrt((p1.x - points[j].x) ** 2 + (p1.y - points[j].y) ** 2);

                    if (dist < settings.strokeWidth * 2) {
                        this.context.lineTo(...points[j]);
                        this.context.moveTo(...p1);
                    }
                }*/
            }

            this.context.lineTo(...last(points));
            this.context.stroke();

            return this;

            // technique stolen from http://perfectionkills.com/exploring-canvas-drawing-techniques/#bezier-curves
        }

        
        // Other drawers

        image(image, ...drawImageArgs) {
            while (drawImageArgs.length < 2) {
                drawImageArgs.push(0);
            }

            this.context.drawImage(image, ...drawImageArgs);

            return this;
        }

        imageData(data, ...putImageDataArgs) {
            while (putImageDataArgs.length < 2) {
                putImageDataArgs.push(0);
            }

            this.context.putImageData(data, ...putImageDataArgs);

            return this;
        }
        
        /**
         * Fills the canvas with the current fillStyle.
         * @returns {Canvas}
         */
        cover() {
            this.context.fillRect(...this.dims());
            return this;
        }

        /**
         * Cuts or expands the canvas while retaining its content and style settings.
         * @param {number} x Horizontal offset of the top-left corner of the trimming rectangle.
         * @param {number} y Vertical offset of the top-left corner of the trimming rectangle.
         * @param {number} w Width of the trimming rectangle.
         * @param {number} h Height of the trimming rectangle.
         * @returns {Canvas}
         */
        crop(x, y, w, h) {
            const data = this.toImageData(x, y, w, h);

            this.context.save();

            this.width(w);
            this.height(h);

            this.context.restore();

            this.imageData(data, -x, -y);

            return this;
        }

        /**
         * Tests if a one-pixel-high slice of a canvas is fully transparent.
         * @param {number} offset Vertical offset of the row to test.
         * @returns {boolean}
         */
        rowIsTransparent(offset) {
            if (offset < 0 || offset >= this.height()) {
                return false;
            }

            const row = this.toImageData(0, offset, this.width(), 1).data;
            return Canvas.imageDataIsEmpty(row);
        }

        /**
         * Tests if a one-pixel-wide slice of a canvas is fully transparent.
         * @param {number} offset Horizontal offset of the column to test.
         * @returns {boolean}
         */
        colIsTransparent(offset) {
            if (offset < 0 || offset >= this.width()) {
                return false;
            }

            const col = this.toImageData(offset, 0, 1, this.height()).data;
            return Canvas.imageDataIsEmpty(col);
        }

        
        // Filters

        filterConvolution(weightsMatrix) { // TODO: WebWorker pls
            // alg adapted from https://www.html5rocks.com/en/tutorials/canvas/imagefilters/

            const matrixDim = Math.sqrt(weightsMatrix.length);
            if (matrixDim !== Math.floor(matrixDim)) throw new RangeError("Provided weight matrix is not a square");
            if (matrixDim === 0) return this;

            const halfMatrixDim = Math.floor(matrixDim / 2);

            const imageData = this.toImageData();
            const resultImageData = this.createImageData();

            // each pixel
            for (let x = 0; x < imageData.width; x++) {
                for (let y = 0; y < imageData.height; y++) {
                    const channelSums = [0, 0, 0];
                    // each element of the convolution matrix
                    for (let convBoxX = 0; convBoxX < matrixDim; convBoxX++) {
                        for (let convBoxY = 0; convBoxY < matrixDim; convBoxY++) {
                            // where each element of the convolution matrix falls on the image
                            const convBoxImageX = x + convBoxX - halfMatrixDim;
                            const convBoxImageY = y + convBoxY - halfMatrixDim;
                            if (convBoxImageX < 0 || convBoxImageX >= imageData.width || convBoxImageY < 0 || convBoxImageY >= imageData.height) continue;

                            const srcIndexOffset = 4 * (convBoxImageY * imageData.width + convBoxImageX);
                            const targetWeight = weightsMatrix[convBoxY * matrixDim + convBoxX];
                            for (let i = 0; i < 3; i++) {
                                channelSums[i] += imageData.data[srcIndexOffset + i] * targetWeight;
                            }
                        }
                    }
            
                    const resultIndexOffset = 4 * (y * imageData.width + x);
                    for (let i = 0; i < 3; i++) {
                        resultImageData.data[resultIndexOffset + i] = channelSums[i];
                    }
                    resultImageData.data[resultIndexOffset + 3] = 255;
                }
            }

            this.imageData(resultImageData);
            return this;
        }

        /**
         * Tests the transparency of each pixel on the canvas and sets it to either fully transparent or fully opaque 
         * depending on its position relative to a given threshold.
         * @param {number} [threshold=127] Alpha threshold above which pixels of alpha values that place will become 
         *     fully opaque.
         * @returns {Canvas}
         */
        async alias(threshold=127) { 
            const imageData = this.toImageData();

            for (let i = 3; i < imageData.data.length; i += 4) {
                if (imageData.data[i] > threshold) {
                    imageData.data[i] = 255;
                } else {
                    imageData.data[i] = 0;
                }
            }

            this.imageData(imageData);

            return this;
        }


        // Exporting

        /**
         * Exports the canvas as a data URL.
         * @param {string} [type] The MIME type of the new file.
         * @returns {string}
         */
        toSrc(type) {
            return this.canvas.toDataURL(type);
        }

        /**
         * Creates an HTMLImageElement from the canas.
         * @param {function} [onload] The callback to be run when the image finished loading.
         * @param {string} [type] The MIME type of the new file.
         * @returns {Image}
         */
        toImage(onload, type) {
            return newImage(this.toSrc(type), onload);
        }

        toImageData(x=0, y=0, w=this.width(), h=this.height()) {
            return this.context.getImageData(x, y, w, h);
        }

        transfer(target, additionalOnload, ...drawImageArgs) {
            target = new Canvas(target);

            while (drawImageArgs.length < 2) {
                drawImageArgs.push(0);
            }

            // Using ImageData will not work here since transparent pixels can overwrite opaque ones.
            function draw(image) {
                target.image(image, ...drawImageArgs);

                if (additionalOnload) additionalOnload(image);
            }

            this.toImage(draw);
        }


        // Other

        clear() {
            this.save();
            this.context.setTransform(1, 0, 0, 1, 0, 0);
            this.context.clearRect(...this.dims());
            this.restore();
            return this;
        }

        /**
         * Creates a new Canvas wrapper with the same content and dimensions.
         * @returns {Canvas}
         */
        clone() {
            const data = this.toImageData();

            return new Canvas(this.width(), this.height())
                .imageData(data);
        }

        translate(x, y) {
            this.context.translate(x, y);
            return this;
        }

        scale(x, y) {
            this.context.scale(x, y);
            return this;
        }

        rotate(a) {
            this.context.rotate(a);
            return this;
        }

        skew(x, y) {
            this.context.transform(1, Math.tan(y), Math.tan(x), 1, 0, 0);
            return this;
        }

        resetTransform() {
            this.context.resetTransform();
            return this;
        }

        imageSmoothing(value) {
            if (value === undefined) return this.context.imageSmoothingEnabled;
          
            this.context.imageSmoothingEnabled = Boolean(value);
            return this;
        }

        save() {
            this.context.save();
            return this;
        }

        restore() {
            this.context.restore();
            return this;
        }
    }

    class TrimmingRect {
        constructor(x=NaN, y=NaN, width=0, height=0) {
            this.x = x;
            this.y = y;
            this.width = width;
            this.height = height;
        }

        *[Symbol.iterator]() {
            yield* [this.x, this.y, this.width, this.height];
        }

        isEmpty() {
            return isNaN(this.x) || isNaN(this.y);
        }

        merge(merger) {
            if (this.isEmpty() && merger.isEmpty()) {
                return new TrimmingRect();
            } else if (this.isEmpty()) {
                return new TrimmingRect(...merger);
            } else if (merger.isEmpty()) {
                return new TrimmingRect(...this);
            }

            const x = Math.min(this.x, merger.x);
            const y = Math.min(this.y, merger.y);

            const width = this.x + this.width > merger.x + merger.width ?
                this.x + this.width - x :
                merger.x + merger.width - x;

            const height = this.y + this.height > merger.y + merger.height ?
                this.y + this.height - y :
                merger.y + merger.height - y;

            return new TrimmingRect(x, y, width, height);
        }
    }

    function quadraticMidpoint(x1, y1, x2, y2) {
        const x = (x2 - x1) / 2 + x1;
        const y = (y2 - y1) / 2 + y1;

        return { x, y };
    }

    return [Canvas, TrimmingRect];
})();