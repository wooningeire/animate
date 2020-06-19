"use strict";

const Color = (function () {
    class Color {
        /**
         * Represents a color.
         * @param {*} [args] Either three/four values that resolve to numbers and represent RGBA values; an array 
         *     containing them; an object that defines each of the channels of an RGBA, HSLA, HSVA, or CMYKA color; 
         *     or any valid CSS <color>.
         * @return Color
         */
        constructor(...args) {
            let r = args[0];

            if (Array.isArray(r)) {
                args = [...r];
            }
            else if (typeof r === "object") {
                switch (true) {
                    case isDefined(r.r, r.g, r.b     ): args = fromRGBAObject (r); break;
                    case isDefined(r.v               ): args = fromHSVAObject (r); break;
                    case isDefined(r.h, r.s, r.l     ): args = fromHSLAObject (r); break;
                    case isDefined(r.c, r.m, r.y, r.k): args = fromCMYKAObject(r); break;
                    default                           : args = fromRGBAObject (r);
                }
            }

            r = args[0];

            return typeof r === "number" || isN(r) || (typeof r === "string" && r.endsWith("%")) || r === undefined
                ? Object.assign(this, toRGBAObject(args))
                : Color.resolve(r);
        }

        /**
         * Creates a color based on its formatted CSS. Inverse of Color.prototype.toString.
         * @param {string} string A formatted CSS color.
         * @return {Color}
         */
        static resolve(string) {   
            string = clearWhitespace(string).toLowerCase(); // Also calls <toString> on a provided object.

            // This property does not apply to and is not used for every format.
            const c = channelsFromColorFunction();

            // Multiply fourth element by 255 so that the array does not have to be split.
            c[3] *= 255;

            switch (Color.detectFormat(string)) {
                case "rgb" : return new Color(...cTrimmed(), 255);
                case "rgba": return new Color(...c);
            
                case "hsl" : convertSLPercentages(); return Color.hsl(...cTrimmed(), 255);
                case "hsla": convertSLPercentages(); return Color.hsl(...c);

                case "hexadecimal":
                    return Color.hex(string);

                default:
                    return Color.fromName(string);
            }

            function channelsFromColorFunction() {
                return string.substring(string.indexOf("(") + 1, string.lastIndexOf(")")).split(",");
            }

            // Converts <c[1]> (saturation) and <c[2]> (lightness or value) from percentages to numbers.
            function convertSLPercentages() {
                c[1] = convertPercentage(c[1]);
                c[2] = convertPercentage(c[2]);
            }

            function convertPercentage(percentage) {
                percentage = percentage.replace(/[^0-9.%]/g, "");
                if (percentage.endsWith("%")) percentage = percentage.replace(/%/g, "");
                return valuecheckHex(percentage / Color.HEXP);
            }

            function cTrimmed(length=3) {
                const cTrimmed = c.slice(0, length);
                cTrimmed.length = length; // so that the default alpha 255 is not misplaced into a different channel.
                return cTrimmed;
            }
        }

        /**
         * Creates a color based on its hexadecimal form.
         * @param {string} [args] Either a formatted hexadecimal color, a number in hexadecimal format, or three/four 
         *     hexadecimal numbers that each represent an RGBA channel.
         * @return {Color}
         */
        static hex(...args) {
            // Resolution, using the same pattern as does HTML.
            let r = args[0];
            if (typeof r === "string" && args[1] === undefined) {
                if (r.startsWith("#")) r = r.substring(1);

                while (r.length % 3 !== 0 || !r) r += "0";
                if (r.length === 3) r = doublify(r);

                let thirdlen = r.length / 3;
                args = [r.substr(0, 2), r.substr(thirdlen, 2), r.substr(2 * thirdlen, 2)];
            }
        
            return new Color(args.map(c => parseInt(c.toString(16).replace(/[^0-9a-f]/gi, "0"), 16)));
        }
        
        /**
         * Creates a color based on its hue, saturation, lightness, and alpha. This is a shorthand for new Color({hue, 
         * saturation, lightness, alpha}).
         * @param {number} [hue=0] The hue of the color.
         * @param {number|string} [saturation=0] The HSL saturation of the color. 
         * @param {number|string} [lightness=0] The lightness of the color. 
         * @param {number|string} [alpha=255] The opacity of the color. 
         */
        static hsl(hue, saturation, lightness, alpha) {
            return new Color({ h: hue, s: saturation, l: lightness, a: alpha });
        }

        /**
         * Creates a color based on its hue, saturation, value, and alpha. This is a shorthand for new Color({hue, 
         * saturation, value, alpha}).
         * @param {number} [hue=0] The hue of the color.
         * @param {number|string} [saturation=0] The HSV saturation of the color. 
         * @param {number|string} [value=0] The value of the color. 
         * @param {number|string} [alpha=255] The opacity of the color. 
         */
        static hsv(hue, saturation, value, alpha) {
            return new Color({ h: hue, s: saturation, v: value, a: alpha });
        }

        /**
         * Creates a color based on its cyan, magenta, yellow, key, and alpha values. This is a shorthand for new 
         * Color({cyan, magenta, yellow, key, alpha}).
         * @param {number|string} [cyan=0] The cyan in the color.
         * @param {number|string} [magenta=0] The magenta in the color.
         * @param {number|string} [yellow=0] The yellow in the color.
         * @param {number|string} [key=0] The black in the color.
         * @param {number|string} [alpha=0] The opacity of the color.
         */
        static cmyk(cyan, magenta, yellow, key, alpha) {
            return new Color({ c: cyan, m: magenta, y: yellow, k: key, a: alpha });
        }

        /**
         * Produces a color based on its HTML name.
         * @param {string} name The HTML name of the color.
         * @return {Color}
         */
        static fromName(name) {
            name = clearWhitespace(name);

            if (Color.html && Color.html.hasOwnProperty(name)) {
                return Color.html[name].clone();
            }

            return Color.hex(name);
        }

        /**
         * Produces a color based on its number value.
         * @param {number} integer The integer from which to create the color.
         * @return {Color}
         */
        static fromInteger(integer) {
            const string = valuecheck(integer, { integer: true, min: 0, max: 0xFFFFFF }).toString(16).padStart(6, "0");

            return Color.hex(string);
        }

        /**
         * Determines the format of a CSS-valid color string. ("rgb", "rgba", "hsl", "hsla", "hexadecimal", "name")
         * @param {string} string The string to compare.
         * @return {string}
         */
        static detectFormat(string) {
            string = clearWhitespace(string);

            switch (true) {
                case isFunctionOf("rgb" ): return "rgb" ;
                case isFunctionOf("rgba"): return "rgba";
                case isFunctionOf("hsl" ): return "hsl" ;
                case isFunctionOf("hsla"): return "hsla";

                case string.startsWith("#") && (string.length === 4 || string.length === 7): return "hexadecimal";
                
                default: return "name"; 
            }

            function isFunctionOf(functionType) {
                return (string.startsWith(`${functionType}(`) && string.endsWith(")")); 
            }
        }

        /**
         * Returns a color with random channel values.
         * @param {boolean} randomAlpha Whether or not to pick a random opacity value.
         * @return {Color}
         */
        static random(randomAlpha) {
            const color = Color.fromInteger(Math.random() * 0xFFFFFF);
            color.a = randomAlpha ? Math.floor(Math.random() * 255) : 255;
            return color;
        }

        /**
         * Returns the CSS-formatted string representation of a color.
         * @param {string} [type="rgba"] The format of a color to use. ("rgb", "rgba", "hsl", "hsla", "hex" | 
         *     "hexadecimal")
         * @return {Color}
         */
        toString(type) {
            switch (type) {
                // No need to break after a case; return terminates the switch block by default.
                case "rgb":
                    return `rgb(${this.r},${this.g},${this.b})`;
                
                case "hex":
                case "hexadecimal":
                    return "#" + this.toHexNumber();

                case "hsl":
                    return `hsl(${this.h},${this.s * Color.HEXP}%,${this.l * Color.HEXP}%)`;
                case "hsla":
                    return `hsla(${this.h},${this.s * Color.HEXP}%,${this.l * Color.HEXP}%,${this.a / 255})`;
            
                // Default to "rgba".
                default:
                    return `rgba(${ this.r },${ this.g },${ this.b },${ this.a / 255})`;
            }
        }

        /**
         * Returns the color represented as six-digit hexadecimal number (without a trailing hashtag).
         * @return {string}
         */
        toHexNumber() {
            return toHex(this.r) + toHex(this.g) + toHex(this.b);
        }

        /**
         * Returns the color represented as an integer.
         * @return {number}
         */
        toInteger() {
            return parseInt(this.toHexNumber(), 16);
        }

        /**
         * Returns an RGBA array representing the color.
         * @param {boolean} [excludeAlpha=false] Whether or not to exclude alpha as the fourth item in the array.
         * @return {Array}
         */
        toArray(excludeAlpha) {
            return excludeAlpha ? [this.r, this.g, this.b] : [this.r, this.g, this.b, this.a];
        }
        
        /**
         * Returns a new color with a specified filter applied to it.
         * @param {string} [type] The type of filter. (valid  CSS color-wise <filter-function> name)
         * @param {number} [level=1] Intensity of the filter.
         * @return {Color}
         */
        filter(type, level=1) {
            level = valuecheck({ nan: 1, infinity: 1 });

            switch (type) {
                case "brightness":
                    return this.clone().lighten(level * 100 + "%");

                case "contrast":
                    return this.clone();

                case "grayscale":
                    return new Color(...this.toArray(true).map(c => this.sum() * level - c * level + c), this.a);

                case "hue-rotate":
                    return this.clone().rotateHue(level);

                case "invert":
                    return new Color(...this.toArray(true).map(c => 255 * level - 2 * c * level + c), this.a);

                case "opacity":
                    return new Color(...this.toArray(true), this.a * level);

                case "saturate":
                    return this.clone().saturate(level * 100 + "%");

                case "sepia": {
                    let l = this.getPerceivedLightness();
                    return new Color(
                        l + 40 * level,
                        l + 20 * level,
                        l - 20 * level,
                        this.a
                    );
                }
                
                default:
                    return this.clone();
            }
        }
        
        /**
         * Blends two colors using a specified blend mode and returns the result.
         * @param {Color} [color=new Color()] The color with which to be blended. 
         * @param {string} [blendmode="normal"] The type of blend mode to use (valid CSS <blend-mode> | "add" | 
         *     "subtract" | "divide" | "linear-burn").
         * @return {Color}
         */
        blend(color=new Color(), blendmode="normal") {
            if (!(color instanceof Color)) color = new Color(color);

            const priRGB = this.toArray(true);
            const secRGB = color.toArray(true);
            
            switch (blendmode) {
                case "multiply":
                    return channelBlend(
                        (a, b) => a * b * color.a / 255
                    );

                case "screen":
                    return channelBlend(
                        (a, b) => 1 - (1 - a) * (1 - b)
                    );

                case "overlay":
                    return channelBlend(
                        (a, b) => a < .5
                            ? 2 * a * b
                            : 1 - 2 * (1 - a) * (1 - b)
                    );

                case "darken":
                    return channelBlend(
                        (a, b) => Math.min(a, b)
                    );

                case "lighten":
                    return channelBlend(
                        (a, b) => Math.max(a, b)
                    );

                case "color-dodge":
                    return channelBlend(
                        (a, b) => a / (1 - b)
                    );

                case "color-burn":
                    return channelBlend(
                        (a, b) => 1 - (1 - a) / b
                    );

                case "hard-light":
                    return channelBlend(
                        (b, a) => a < .5
                            ? 2 * a * b
                            : 1 - 2 * (1 - a) * (1 - b)
                    );

                case "soft-light": {
                    let g =
                        a => a <= .25
                            ? ((16 * a - 12) * a + 4) * a
                            : Math.sqrt(a); 

                    return channelBlend(
                        (a, b) => b <= .5
                            ? a - (1 - 2 * b) * a * (1 - a)
                            : a + (2 * b - 1) * (g(a) - a)
                    );
                }

                case "difference":
                    return channelBlend(
                        (a, b) => Math.abs(a - b * color.a / 255)
                    );

                case "exclusion":
                    return channelBlend(
                        (a, b) => a * b * (1 - a) * (1 - b)
                    );

                case "hue":
                    return Color.hsl(color.h, this.s, this.l);

                case "saturation":
                    return Color.hsl(this.h, color.s, this.l);

                case "color":
                    return Color.hsl(color.h, color.s, this.l);

                case "luminosity":
                    return Color.hsl(this.h, this.s, color.l);


                case "add":
                    return channelBlend(
                        (a, b) => a + b * color.a / 255
                    );

                case "subtract":
                    return channelBlend(
                        (a, b) => a - b * color.a / 255
                    );

                case "divide":
                    return channelBlend(
                        (a, b) => a / b * color.a / 255
                    );

                case "linear-burn":
                    return channelBlend(
                        (a, b) => a + b - 1
                    );

                default:
                    //  (c2 * c1 + (255 - color.a) * c1) / 255
                    return channelBlend(
                        (a, b) => Math.abs(color.a * (b - a) / 255 + a)
                    );
            }

            function channelBlend(blendingFunction) {
                const blendedChannels = [];

                for (let i = 0; i < priRGB.length; i++) {
                    blendedChannels.push(blendingFunction(priRGB[i] / 255, secRGB[i] / 255) * 255);
                }

                return new Color(...blendedChannels, this.a + (255 - this.a) * color.a / 255);
            }
        }

        lowestRGBAEquivalent() {
            if (this.a !== 255) throw new RangeError("Only usable on fully opaque colors.");
            
            const min = this.min();
            const a = 1 - min / 255;

            const r = (this.r - min) / a;
            const g = (this.g - min) / a;
            const b = (this.b - min) / a;

            return new Color(r, g, b, a * 255);
        }

        rgbLinear(color=new Color(), x=.5) {
            x = valuecheck(x, { min: 0, max: 1, nan: .5 });

            function getLineValue(n1, n2) {
                return (n2 - n1) * x + n1;
            }

            const r = getLineValue(this.r, color.r);
            const g = getLineValue(this.g, color.g);
            const b = getLineValue(this.b, color.b);

            return new Color(r, g, b, this.a);
        }

        hslLinear(color=new Color(), x=.5) {
            x = valuecheck(x, { min: 0, max: 1, nan: .5 });

            function getLineValue(n1, n2) {
                return (n2 - n1) * x + n1;
            }

            const h = this.rgbLinear(color, x).h;
            const s = getLineValue(this.s, color.s);
            const l = getLineValue(this.l, color.l);

            return Color.hsl(h, s, l, this.a);
        }

        /**
         * Returns the sum of a colors red, green, and blue values.
         * @return {number}
         */
        sum() {
            return this.r + this.g + this.b;
        }

        /**
         * Returns the greatest value of a color’s RGB channels.
         * @return {number}
         */
        max() {
            return Math.max(this.r, this.g, this.b);
        }

        /**
         * Returns the smallest value of a color’s RGB channels.
         * @return {number}
         */
        min() {
            return Math.min(this.r, this.g, this.b);
        }

        /**
         * Constructs a new color with the same RGBA values.
         * @return {Color}
         */
        clone() {
            return new Color(this.r, this.g, this.b, this.a);
        }

        /**
         * Calculates the perceived lightness of a color out of 255.
         * @return {number}
         */
        getPerceivedLightness() {
            return (3 * this.r + 4 * this.g + this.b) >>> 3;
        }

        /**
         * Sets the value of the color’s red channel.
         * @param {number|string} [red=0] The new red value.
         * @return {Color} This color.
         */
        setRed(red) {
            this.r = red;
            return this;
        }
        /**
         * Sets the value of the color’s green channel.
         * @param {number|string} [green=0] The new green value.
         * @return {Color} This color.
         */
        setGreen(green) {
            this.g = green;
            return this;
        }
        /**
         * Sets the value of the color’s blue channel.
         * @param {number|string} [blue=0] The new blue value.
         * @return {Color} This color.
         */
        setBlue(blue) {
            this.b = blue;
            return this;
        }
        /**
         * Sets the color’s hue.
         * @param {number} [hue=0] The new hue.
         * @return {Color} This color.
         */
        setHue(hue) {
            this.h = hue;
            return this;
        }
        /**
         * Sets the color’s saturation, as defined by HSL.
         * @param {number|string} [saturation=0] The new saturation value.
         * @return {Color} This color.
         */
        setSaturation(saturation) {
            this.s = saturation;
            return this;
        }
        /**
         * Sets the color’s saturation, as defined by HSV.
         * @param {number|string} [saturation=0] The new saturation value.
         * @return {Color} This color.
         */
        setSaturationHSV(saturation) {
            this.sHSV = saturation;
            return this;
        }
        /**
         * Sets the color’s lightness.
         * @param {number|string} [lightness=0] The new lightness value.
         * @return {Color} This color.
         */
        setLightness(lightness) {
            this.l = lightness;
            return this;
        }
        /**
         * Sets the color’s value.
         * @param {number|string} [value=0] The new value.
         * @return {Color} This color.
         */
        setValue(value) {
            this.v = value;
            return this;
        }
        /**
         * Sets the color’s cyan value.
         * @param {number|string} [cyan=0] The new cyan value.
         * @return {Color} This color.
         */
        setCyan(cyan) {
            this.c = cyan;
            return this;
        }
        /**
         * Sets the color’s yellow value.
         * @param {number|string} [yellow=0] The new yellow value.
         * @return {Color} This color.
         */
        setYellow(yellow) {
            this.y = yellow;
            return this;
        }
        /**
         * Sets the color’s magenta value.
         * @param {number|string} [magenta=0] The new magenta value.
         * @return {Color} This color.
         */
        setMagenta(magenta) {
            this.m = magenta;
            return this;
        }
        /**
         * Sets the color’s key value.
         * @param {number|string} [key=0] The new key value.
         * @return {Color} This color.
         */
        setKey(key) {
            this.k = key;
            return this;
        }
        /**
         * Sets the color’s opacity.
         * @param {number|string} [alpha=255] The new alpha value.
         * @return {Color} This color.
         */
        setAlpha(alpha) {
            this.a = alpha;
            return this;
        }

        /**
         * Shifts the hue of the color.
         * @param {number} [degrees=0] The number of degrees by which to shift the hue.
         * @return {Color} This color.
         */
        rotateHue(degrees) {
            this.h += degrees;
            return this;
        }
        /**
         * Saturates the color.
         * @param {number|string} [points=0] The number of points by which to saturate the color or a percentage by 
         *     which to multiply the saturation.
         * @return {Color} This color.
         */
        saturate(points) {
            if (isPercentage(points)) {
                this.s *= trimlast(points) / 100;
            } else {
                this.s += points;
            }

            return this;
        }
        /**
         * Lightens the color.
         * @param {number|string} [points=0] The number of points by which to lighten the color or the color or a 
         *     percentage by which to multiply the lightness.
         * @return {Color} This color.
         */
        lighten(points) {
            if (isPercentage(points)) {
                this.l *= trimlast(points) / 100;
            } else {
                this.l += points;
            }
            return this;
        }
        /**
         * Shifts the opacity of the color.
         * @param {number|string} [points=0] The number of points by which to opacify the color or the color or a 
         *     percentage by which to multiply the opacity.
         * @return {Color} This color.
         */
        opacify(points) {
            if (isPercentage(points)) {
                this.a *= trimlast(points) / 100;
            } else {
                this.a += points;
            }
            return this;
        }
    
        get r() {
            return valuecheckHex(this._r);
        }
        set r(red) {
            this._r = valuecheckHex(red);
        }

        get g() {
            return valuecheckHex(this._g);
        }
        set g(green) {
            this._g = valuecheckHex(green);
        }

        get b() {
            return valuecheckHex(this._b);
        }
        set b(blue) {
            this._b = valuecheckHex(blue);
        }

        get a() {
            return valuecheckHexMax(this._a);
        }
        set a(alpha) {
            this._a = valuecheckHexMax(alpha);
        }

        get h() {
            let h;
            
            const [r, g, b, a] = [this.r, this.g, this.b, this.a];

                 if (r >= g && g >= b) h = 60 *      (g - b) / (r - b) ;
            else if (g >  r && r >= b) h = 60 * (2 - (r - b) / (g - b));
            else if (g >= b && b >  r) h = 60 * (2 + (b - r) / (g - r));
            else if (b >  g && g >  r) h = 60 * (4 - (g - r) / (b - r));
            else if (b >  r && r >= g) h = 60 * (4 + (r - g) / (b - g));
            else if (r >= b && b >  g) h = 60 * (6 - (b - g) / (r - g));

            return isNaN(h) ? 0 : h;
        }
        set h(hue) {
            const color = Color.hsl(hue, this.s, this.l);
            
            this.r = color.r;
            this.g = color.g;
            this.b = color.b;
        }

        get s() {
            const min = this.min() / 255;
            const max = this.max() / 255;

            if (max == min) {
                return 0;
            } else {
                let d = max - min;

                return this.l > 255 / 2
                    ? d / (2 - max - min) * 255
                    : d / (max + min) * 255;
            }
        }
        set s(saturation) {
            const color = Color.hsl(this.h, saturation, this.l);
            
            this.r = color.r;
            this.g = color.g;
            this.b = color.b;
        }

        get sHSV() {
            const min = this.min();
            const max = this.max();

            return (max - min) / max * 255 || 0;
        }
        set sHSV(saturation) {
            const color = Color.hsv(this.h, saturation, this.l);
            
            this.r = color.r;
            this.g = color.g;
            this.b = color.b;
        }

        get l() {
            return (this.max() + this.min()) / 2;
        }
        set l(lightness) {
            const color = Color.hsl(this.h, this.s, lightness);
            
            this.r = color.r;
            this.g = color.g;
            this.b = color.b;
        }

        get v() {
            return this.max();
        }

        set v(value) {
            const color = Color.hsl(this.h, this.s, value);
            
            this.r = color.r;
            this.g = color.g;
            this.b = color.b;
        }

        get c() {
            const v = this.v;
            return (v - this.r) / v * 255 || 0;
        }
        set c(cyan) {
            const color = Color.cmyk(cyan, this.m, this.y, this.k);

            this.r = color.r;
            this.g = color.g;
            this.b = color.b;
        }

        get m() {
            const v = this.v;
            return (v - this.g) / v * 255 || 0;
        }

        set m(magenta) {
            const color = Color.cmyk(this.c, magenta, this.y, this.k);

            this.r = color.r;
            this.g = color.g;
            this.b = color.b;
        }

        get y() {
            const v = this.v;
            return (v - this.b) / v * 255 || 0;
        }

        set y(yellow) {
            const color = Color.cmyk(this.c, this.m, yellow, this.k);

            this.r = color.r;
            this.g = color.g;
            this.b = color.b;
        }

        get k() {
            return 255 - this.v;
        }

        set k(key) {
            const color = Color.cmyk(this.c, this.m, this.y, key);

            this.r = color.r;
            this.g = color.g;
            this.b = color.b;
        }

        [Symbol.toPrimitive](hint) {
            if (hint === "number") return this.toInteger();
            if (hint === "string") return this.toString();
            return this.toString();
        }

        * [Symbol.iterator]() {
            yield* this.toArray();
        }
    }

    /**
     * @namespace Color
     * @property {object} html An object mapping each valid HTML color name to its corresponding Color object.
     * @property {number} HEXP A ratio used to convert a number out of 255 to a number out of 100.
     */
    
    Color.html = (function () {
        const colors = {
            aliceblue: "f0f8ff",
            antiquewhite: "faebd7",
            aqua: "0ff",
            cyan: "0ff",
            aquamarine: "7fffd4",
            azure: "f0ffff",
            beige: "f5f5dc",
            bisque: "ffe4c4",
            black: "000",
            blanchedalmond: "ffebcd",
            blue: "00f",
            blueviolet: "8a2be2",
            brown: "a52a2a",
            burlywood: "deb887",
            cadetblue: "5f9ea0",
            chartreuse: "7fff00",
            chocolate: "d2691e",
            coral: "ff7f50",
            cornflowerblue: "6495ed",
            cornsilk: "fff8dc",
            crimson: "dc143c",
            darkblue: "00008b",
            darkcyan: "008b8b",
            darkgoldenrod: "b8860b",
            darkgray: "a9a9a9",
            darkgrey: "a9a9a9",
            darkgreen: "006400",
            darkkhaki: "bdb76b",
            darkmagenta: "8b008b",
            darkolivegreen: "556b2f",
            darkorange: "ff8c00",
            darkorchid: "9932cc",
            darkred: "8b0000",
            darksalmon: "e9967a",
            darkseagreen: "8fbc8f",
            darkslateblue: "483d8b",
            darkslategray: "2f4f4f",
            darkslategrey: "2f4f4f",
            darkturquoise: "00ced1",
            darkviolet: "9400d3",
            deeppink: "ff1493",
            deepskyblue: "00bfff",
            dimgray: "696969",
            dimgrey: "696969",
            dodgerblue: "1e90ff",
            firebrick: "b22222",
            floralwhite: "fffaf0",
            forestgreen: "228b22",
            fuchsia: "f0f",
            magenta: "f0f",
            gainsboro: "dcdcdc",
            ghostwhite: "f8f8ff",
            gold: "ffd700",
            goldenrod: "daa520",
            gray: "808080",
            grey: "808080",
            green: "008000",
            greenyellow: "adff2f",
            honeydew: "f0fff0",
            hotpink: "ff69b4",
            indianred: "cd5c5c",
            indigo: "4b0082",
            ivory: "fffff0",
            khaki: "f0e68c",
            lavender: "e6e6fa",
            lavenderblush: "fff0f5",
            lawngreen: "7cfc00",
            lemonchiffon: "fffacd",
            lightblue: "add8e6",
            lightcoral: "f08080",
            lightcyan: "e0ffff",
            lightgoldenrodyellow: "fafad2",
            lightgray: "d3d3d3",
            lightgrey: "d3d3d3",
            lightgreen: "90ee90",
            lightpink: "ffb6c1",
            lightsalmon: "ffa07a",
            lightseagreen: "20b2aa",
            lightskyblue: "87cefa",
            lightslategray: "789",
            lightslategrey: "789",
            lightsteelblue: "b0c4de",
            lightyellow: "ffffe0",
            lime: "0f0",
            limegreen: "32cd32",
            linen: "faf0e6",
            maroon: "800000",
            mediumaquamarine: "66cdaa",
            mediumblue: "0000cd",
            mediumorchid: "ba55d3",
            mediumpurple: "9370d8",
            mediumseagreen: "3cb371",
            mediumslateblue: "7b68ee",
            mediumspringgreen: "00fa9a",
            mediumturquoise: "48d1cc",
            mediumvioletred: "c71585",
            midnightblue: "191970",
            mintcream: "f5fffa",
            mistyrose: "ffe4e1",
            moccasin: "ffe4b5",
            navajowhite: "ffdead",
            navy: "000080",
            oldlace: "fdf5e6",
            olive: "808000",
            olivedrab: "6b8e23",
            orange: "ffa500",
            orangered: "ff4500",
            orchid: "da70d6",
            palegoldenrod: "eee8aa",
            palegreen: "98fb98",
            paleturquoise: "afeeee",
            palevioletred: "d87093",
            papayawhip: "ffefd5",
            peachpuff: "ffdab9",
            peru: "cd853f",
            pink: "ffc0cb",
            plum: "dda0dd",
            powderblue: "b0e0e6",
            purple: "800080",
            rebeccapurple: "639",
            red: "f00",
            rosybrown: "bc8f8f",
            royalblue: "4169e1",
            saddlebrown: "8b4513",
            salmon: "fa8072",
            sandybrown: "f4a460",
            seagreen: "2e8b57",
            seashell: "fff5ee",
            sienna: "a0522d",
            silver: "c0c0c0",
            skyblue: "87ceeb",
            slateblue: "6a5acd",
            slategray: "708090",
            slategrey: "708090",
            snow: "fffafa",
            springgreen: "00ff7f",
            steelblue: "4682b4",
            tan: "d2b48c",
            teal: "008080",
            thistle: "d8bfd8",
            tomato: "ff6347",
            turquoise: "40e0d0",
            violet: "ee82ee",
            wheat: "f5deb3",
            white: "fff",
            whitesmoke: "f5f5f5",
            yellow: "ff0",
            yellowgreen: "9acd32"
        };

        for (let [name, string] of Object.entries(colors)) {
            Object.defineProperty(colors, name, {
                value: Object.freeze(Color.resolve(string)),
                writable: false,
                enumerable: true,
                configurable: false,
            })
        }
        return Object.freeze(colors);
    })();
    Object.defineProperty(Color, "HEXP", { value: 20 / 51 });

    function valuecheck(value, options={}) {
        if (isPercentage(value)) {
            if (isNaN(options.percentageRatio)) options.percentageRatio = 100;
            value = trimlast(value) / options.percentageRatio;
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

    // for readability
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

    function valuecheckHex(n, options) {
        return valuecheck(n, Object.assign({ min: 0, max: 255, integer: true, percentageRatio: Color.HEXP }, options));
    }

    function valuecheckHexMax(n) {
        return valuecheckHex(n, { nan: 255, infinity: 255 });
    }

    function toRGBAObject(array) {
        return Object.assign(objmap({ r: array[0], g: array[1], b: array[2] }, valuecheckHex), { a: valuecheckHexMax(array[3]) });
    }
    
    function fromRGBAObject(obj) {
        return acknowledgeAlpha(obj, [obj.r, obj.g, obj.b].map(valuecheckHex));
    }

    function fromHSLAObject(obj) {
        const h = valuecheck(mod(obj.h, 360), { integer: true });
        const s = valuecheckHex(obj.s) / 255;
        const l = valuecheckHex(obj.l) / 255;

        const c = s * (1 - Math.abs(2 * l - 1));
        const x = c * (1 - Math.abs(h / 60 % 2 - 1));

        let primes;
        
             if (            h < 60 ) primes = [c, x, 0];
        else if (h >= 60  && h < 120) primes = [x, c, 0];
        else if (h >= 120 && h < 180) primes = [0, c, x];
        else if (h >= 180 && h < 240) primes = [0, x, c];
        else if (h >= 240 && h < 300) primes = [x, 0, c];
        else                          primes = [c, 0, x];

        const m = l - c / 2;

        return acknowledgeAlpha(obj, primes.map(p => (p + m) * 255));
    }

    function fromHSVAObject(obj) {      
        const h = obj.h;
        let s = valuecheckHex(obj.s) / 255;
        const v = valuecheckHex(obj.v) / 255;
        const a = obj.a;

        let l = v * (2 - s) / 2;

        s = (v * s) / (1 - Math.abs(2 * l - 1));

        s *= 255;
        l *= 255;
        return fromHSLAObject({ h, s, l, a });
    }

    function fromCMYKAObject(obj) {
        const [c, m, y, k] = [obj.c, obj.m, obj.y, obj.k].map(valuecheckHex);
        const v = 255 - k;
        return acknowledgeAlpha(obj, [c, m, y].map(c => (255 - c) * v / 255));
    }

    function acknowledgeAlpha(obj, array) {
        return array.concat([valuecheckHexMax(obj.a)]);
    }

    function objmap(obj, fn) {
        const x = {};
        for (let k of Object.keys(obj)) x[k] = fn(obj[k]);
        return x;
    }

    function toHex(n) {
        return pad(valuecheckHex(n).toString(16), 2);
    }

    function pad(s, length, char="0") {
        return char.repeat(Math.max(length - s.length, 0)) + s;
    }

    function clearWhitespace(string) {
        // Use <Function.prototype.call> so that <null> and <undefined> inputs don't throw errors.
        return toString(string).replace(/\s/g, "");
    }

    function toString(object) {
        // "== undefined" includes <null>
        return object === undefined ? Object.prototype.toString.call(object) : object.toString();
    }

    function mod(a, b) {
        return ((a % b + b) % b);
    }

    function doublify(string) {
        return string.split("").map(c => c.repeat(2)).join("");
    }

    function isPercentage(string) {
        return typeof string === "string" && string.endsWith("%");
    }

    function trimlast(string) {
        return string.substring(0, string.length - 1);
    }

    return function (...args) {
        return new Color(...args);
    };
})();