import { MathUtils, Vector3 } from "three";

/** Unit vector for a latitude/longitude (degrees), with y up and Greenwich towards +z-ish. */
export function latLonToUnit(lat: number, lon: number, out = new Vector3()) {
    const phi = MathUtils.degToRad(90 - lat);
    const th = MathUtils.degToRad(lon + 180);
    return out.set(-Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th));
}

/**
 * Unit vector towards the sun (the sub-solar point) at a given moment, in the same frame as
 * latLonToUnit. Accurate to a degree or so, which is plenty for a day/night shadow.
 */
export function sunDirection(date = new Date(), out = new Vector3()) {
    const dayOfYear = (date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86_400_000;
    const declination = -23.44 * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10));
    const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
    return latLonToUnit(declination, (12 - utcHours) * 15, out); // the sun is overhead at 12:00 UTC on lon 0
}

/*
 * Node locations. The mirror node describes each node as "Host | City, Country"; these are
 * approximate coordinates for those host cities (state/region centres where only a state or region
 * is given). Lookup ignores case and accents.
 */
const CITY_COORDS: Record<string, [number, number]> = {
    "singapore": [1.35, 103.82], "iowa, usa": [41.9, -93.1], "tokyo, japan": [35.68, 139.69],
    "helsinki, finland": [60.17, 24.94], "kuwait city, kuwait": [29.38, 47.99],
    "sao paulo, brazil": [-23.55, -46.63], "frankfurt, germany": [50.11, 8.68],
    "texas, usa": [31.0, -99.9], "berlin, germany": [52.52, 13.4], "roubaix, france": [50.69, 3.18],
    "sydney, australia": [-33.87, 151.21], "paris, france": [48.86, 2.35],
    "london, uk": [51.51, -0.13], "michigan, usa": [44.3, -85.6],
    "falkenstein, germany": [50.48, 12.37], "naaldwijk, netherlands": [51.99, 4.21],
    "quebec, canada": [46.81, -71.21], "mumbai, india": [19.08, 72.88],
    "stockholm, sweden": [59.33, 18.07], "virginia, usa": [37.43, -78.66],
    "la rioja, spain": [42.29, -2.54], "zurich, switzerland": [47.37, 8.54],
    "brussels, belgium": [50.85, 4.35], "cork, ireland": [51.9, -8.47],
    "vilnius, lithuania": [54.69, 25.28],
    // other common hosting locations, in case nodes move or are added
    "amsterdam, netherlands": [52.37, 4.9], "dublin, ireland": [53.35, -6.26],
    "madrid, spain": [40.42, -3.7], "milan, italy": [45.46, 9.19], "warsaw, poland": [52.23, 21.01],
    "vienna, austria": [48.21, 16.37], "oslo, norway": [59.91, 10.75],
    "copenhagen, denmark": [55.68, 12.57], "munich, germany": [48.14, 11.58],
    "new york, usa": [40.71, -74.01], "new jersey, usa": [40.06, -74.41],
    "ohio, usa": [40.42, -82.91], "oregon, usa": [43.8, -120.55],
    "california, usa": [36.78, -119.42], "illinois, usa": [40.63, -89.4],
    "georgia, usa": [32.17, -82.9], "washington, usa": [47.75, -120.74],
    "dallas, usa": [32.78, -96.8], "chicago, usa": [41.88, -87.63],
    "montreal, canada": [45.5, -73.57], "toronto, canada": [43.65, -79.38],
    "hong kong": [22.32, 114.17], "seoul, south korea": [37.57, 126.98],
    "dubai, uae": [25.2, 55.27], "tel aviv, israel": [32.09, 34.78],
    "johannesburg, south africa": [-26.2, 28.05], "nairobi, kenya": [-1.29, 36.82],
    "bangalore, india": [12.97, 77.59], "chennai, india": [13.08, 80.27],
    "jakarta, indonesia": [-6.21, 106.85], "melbourne, australia": [-37.81, 144.96],
}; // prettier-ignore

const normPlace = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** [lat, lon] for a mirror-node location string, or null when the city isn't mapped. */
export function coordsFor(loc: string): [number, number] | null {
    const k = normPlace(loc || "");
    if (!k) return null;
    return CITY_COORDS[k] ?? CITY_COORDS[k.split(",")[0].trim()] ?? null;
}
