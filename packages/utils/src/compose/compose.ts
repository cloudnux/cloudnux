import { ResultsOf, ValidEnhancers } from "./types";

function compose<TBase>() {
    return <E extends readonly [(...args: any[]) => any, ...Array<(...args: any[]) => any>]>(
        ...enhancers: E & ValidEnhancers<TBase, E>
    ) => {
        return <R>(
            fn: (base: TBase, ...results: ResultsOf<E>) => R
        ) => {
            return async (base: TBase): Promise<Awaited<R>> => {
                const results: any[] = [];
                for (const enhancer of enhancers) {
                    const result = await enhancer(base, ...results);
                    results.push(result);
                }
                return fn(base, ...(results as any)) as Awaited<R>;
            };
        };
    };
}

export { compose };
