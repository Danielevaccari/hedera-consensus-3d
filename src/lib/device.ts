// Hints about the viewer's device and preferences, used to pick lighter defaults.

const media = (q: string) => typeof matchMedia === "function" && matchMedia(q).matches;

export const prefersReducedMotion = () => media("(prefers-reduced-motion: reduce)");

/** Phones, tablets, few-core machines and data-saver mode get the light rendering path. */
export function isLowPowerDevice() {
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
    const touchOnly = media("(pointer: coarse)") && !media("(any-pointer: fine)");
    const fewCores = (nav.hardwareConcurrency ?? 8) <= 4;
    return touchOnly || fewCores || !!nav.connection?.saveData;
}
