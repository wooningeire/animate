# animate
Single-page app that allows users to create a frame-by-frame animation and export it as an image or video.

This `README` was not originally included in the project.

## Hotkeys
| Key										| Action    |
|---    									|---    	|
| <kbd>ArrowRight</kbd> 					| Move to the start of the next frame. |
| <kbd>ArrowLeft</kbd>						| Move to the start of the previous frame. |
| <kbd>ArrowUp</kbd> 						| Select the layer above. |
| <kbd>ArrowDown</kbd>						| Select the layer below. |
| <kbd>Shift</kbd> + <kbd>ArrowDown</kbd>	| Merge the selected layer with the layer below. |
| <kbd>Delete</kbd> 						| Delete the current frame. |
| <kbd>Ctrl</kbd> + <kbd>z</kbd>			| Undo the last action. |
| <kbd>Ctrl</kbd> + <kbd>y</kbd>			| Redo the last action. |
| <kbd>Escape</kbd>							| (While playtesting) Stop a playtest. |
| <kbd>Shift</kbd>							| Edit properties of the mouseovered frame in the timeline. |

## WANIM format
WANIM is a custom-made file format that preserves individual layers and frames. It is available as a format while exporting and importing.

### Internals
Internally, WANIM draws inspiration from the chunk-based organization of the PNG format. A WANIM file is simply a series of strictly consecutive chunks, organized as follows, in order:
| Byte size *(Data type)*	| Description   |
|---    					|---    		|
| 1 *(char)* 				| Identifier declaring this chunk's type. |
| 8 *(uint64)*				| Length, in bytes, of this chunk's data. |
| **\[variable]**			| Chunk data. |

#### Chunk types
A chunk's data can be further divided depending on the chunk's type.

* **`A`** — Project data.
	| Byte size *(Data type)*	| Description   |
	|---    					|---    		|
	| 4 *(uint32)* 				| Frame width. |
	| 4 *(uint32)*				| Frame height. |
	| 4 *(uint32)*				| Number of layers. |
* **`F`** — Frame data.
	| Byte size *(Data type)*	| Description	|
	|---    					|---    		|
	| 4 *(uint32)* 				| Index of the layer to which this frame belongs. |
	| 4 *(uint32)*				| This frame's start, in milliseconds. |
	| 4 *(uint32)*				| This frame's duration, in milliseconds. |
	| **\[variable]**			| PNG image data of this frame without the header. |

## Libraries used
* [gif.js](https://jnordberg.github.io/gif.js/)
* [whammy.js](https://github.com/antimatter15/whammy)