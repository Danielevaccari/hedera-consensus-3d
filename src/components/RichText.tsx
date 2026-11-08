/** Renders text where **segments** are bold, without HTML injection. */
export function RichText({ text }: { text: string }) {
    const parts = text.split("**");
    return <>{parts.map((p, i) => (i % 2 ? <b key={i}>{p}</b> : p))}</>;
}
