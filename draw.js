(() => {
    class Point {
        constructor(x, y, time) {
            this.x = valuecheck(x, { integer: true, nan: 0 });
            this.y = valuecheck(y, { integer: true, nan: 0 });
            this.time = new Date(time);
        }

        *[Symbol.iterator]() {
            yield* [this.x, this.y];
        }
    }

    function P(x, y, time) {
        return new Point(x, y, time);
    }

    const buffers = {
        points: [],

        active: false,

        getPenultimPoint() {
            let index = this.points.length - 2;
            if (index < 0) index = 0;

            return this.points[index];
        },
    };

    // Drawing ////////////////////////////////////////////////////////////////////

    clickAndHold(drawer.canvas, {
        mousedown: recordPoint,
        mousemove: recordPoint,
        mouseup: paintPath,

        referenceElement: layersContainer,
    });

    function recordPoint(event, coords) {
        if (event.button !== 0) return;

        if (!coords) coords = getElementRelativeCoords(event, layersContainer, 1);

        buffers.points.push(P(coords.x, coords.y, Date.now()));

        const penultim = buffers.getPenultimPoint();
        const drawerCoords = [
            penultim.x,// + layersContainer.offsetLeft,
            penultim.y,// + layersContainer.offsetTop,
            coords.x,// + layersContainer.offsetLeft,
            coords.y,// + layersContainer.offsetTop,
        ];

        drawer.instLine(...drawerCoords);
    }


    // Do the math n' transfer the path ///////////////////////////////////////////

    async function paintPath() {
        if (buffers.points.length === 0) return;

        const buffer = new Canvas(drawer.width(), drawer.height())
            .matchStyle()
            .skew(...view.viewport.skewNegation)
            .rotate(...view.viewport.rotateNegation)
            .scale(...view.viewport.scaleNegation)
            .translate(...view.viewport.translateNegation);
        const layer = view.currentLayer.canvas;

        simplifyPath();

        // Draw each point.
        buffer.qCurvePath(buffers.points);
        if (settings.aliasingEnabled) await buffer.alias();


        // Start the resizing and transfering process. //

        // Get the trimmings of both canvases and then calculate the new layer trimming.
        /*const layerTrimming = view.currentLayer.trimming;
        const bufferTrimming = await buffer.getTrimming();

        const newLayerTrimming = layerTrimming.merge(bufferTrimming);

        console.log(layerTrimming, bufferTrimming, newLayerTrimming)

        // Resize the layer.
        let cropX = 0;
        let cropY = 0;
        switch (settings.gco) {
            default:
                if (layerTrimming.isEmpty()) {
                    cropX = newLayerTrimming.x;
                    cropY = newLayerTrimming.y;
                } else {
                    cropX = layerTrimming.x - newLayerTrimming.x;
                    cropY = layerTrimming.y - newLayerTrimming.y;
                } console.log(cropX, cropY);

                layer.crop(cropX, cropY, newLayerTrimming.width, newLayerTrimming.height);
                break;

            case "destination-out":
                break;
        }

        layer.canvas.style.marginLeft = `${newLayerTrimming.x}px`;
        layer.canvas.style.marginTop = `${newLayerTrimming.y}px`;*/
        
        layer.gco(settings.gco);

        buffer.transfer(layer, /*async*/ () => {
            /*const finalLayerTrimming = await layer.getTrimming();
            const currentFrame = view.currentFrame(true);
            currentFrame.x = finalLayerTrimming.x;
            currentFrame.y = finalLayerTrimming.y;*/

            drawer.clear();
            view.currentLayer.recordFrame();
        }/*, -cropX, -cropY*/);

        buffers.points = [];
    }

    function simplifyPath(threshold=settings.simplifyThreshold) {
        for (let i = 0; i < buffers.points.length - 2; i++) {
            const m1 = slope(...buffers.points[i + 1], ...buffers.points[i]);
            const m2 = slope(...buffers.points[i + 2], ...buffers.points[i + 1]);

            const diff = Math.abs(Math.atan(m2) - Math.atan(m1));

            if (diff < threshold) {
                buffers.points.splice(i + 1, 1);
                i--;
            }
        }
    }

    function slope(x1, y1, x2, y2) {
        return (y2 - y1) / (x2 - x1);
    }

    function distance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }

    // Record the layer image and save it to the frame ////////////////////////////

    // Utility functions //

    /*function compareEachWithNexts(array, nexts, compareFn, offset=0) {
        for (let i = offset; i < array.length - nexts; i++) {
            compareFn(...array.slice(i, i + nexts + 1), i, () => i--);
        }
    }*/

    const drawerContextMenu = qs(".drawer-context-menu");
    drawer.canvas.addEventListener("contextmenu", event => {
        event.preventDefault();

        drawerContextMenu.classList.add("active");
        drawerContextMenu.style.left = `${event.x}px`;
        drawerContextMenu.style.top = `${event.y}px`;

        qs(".color-input").value = settings.color.toString("hex");
    }, false);

    addEventListener("mousedown", event => {
        if (event.path.includes(drawerContextMenu) || event.button !== 0) return;
        
        drawerContextMenu.classList.remove("active");
    }, false);

    clickAndHold(qs(".brush-size-slider-bound"), {
        mousedownAndMove(event, relative) {
            const y = Math.max(0, relative.y - 8);
            settings.strokeWidth = (y / 104)**2 * 100;
        },

        referenceElement: drawerContextMenu,
    });

    qs(".color-input").addEventListener("change", event => {
        settings.color = event.currentTarget.value;
    });
    
    function clickAndHold(target, {
        mousedownAndMove=() => {}, mousedown=() => {}, mousemove=() => {}, mouseup=() => {}, boundary=window,
        referenceElement
    }) {
        let targetActive = false;

        const mousedownExclusive = (event, relative) => {
            mousedown(event, relative);
            mousedownAndMove(event, relative);
        };

        const mousemoveExclusive = (event, relative) => {
            mousemove(event, relative);
            mousedownAndMove(event, relative);
        };

        target.addEventListener("mousedown", event => {
            if (event.button !== 0) return;
            targetActive = true;

            handleMouse(mousedownExclusive, event);
        }, false);

        boundary.addEventListener("mousemove", event => {
            if (!targetActive) return;

            getSelection().removeAllRanges();
            handleMouse(mousemoveExclusive, event);
        }, false);

        addEventListener("mouseup", event => {
            targetActive = false;

            handleMouse(mouseup, event);
        }, false);

        function handleMouse(callback, event) {
            const relative = getElementRelativeCoords(event, referenceElement);
            callback(event, relative);
        }
    }
})();