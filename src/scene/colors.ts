import { Color } from "three";
import { BLOCK_HEX, KIND_LIST, type Kind } from "../config";

export const GOLD = new Color("#fde047");
export const WHITE = new Color("#ffffff");
export const RED = new Color("#f87171");
export const BLOCK_COLORS = BLOCK_HEX.map(h => new Color(h));

const kindColors = new Map(KIND_LIST.map(k => [k, new Color(k.hex)]));
export const kindColor = (k: Kind) => kindColors.get(k)!;
