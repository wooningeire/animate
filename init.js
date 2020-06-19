"use strict";

(() => {
    // Set the canvas dimensions.
    settings.strokeWidth = 5;
    settings.cap = "round";
    settings.joint = "round";
    settings.gco = "source-over";
    settings.color = new Color();
    settings.gifTransparencyColor = new Color("#0f0");
    resetDrawer();
    resizeCanvas(800, 600);

    // Create a new layer.
    Layer.add();

    view.ms = 0;
})();