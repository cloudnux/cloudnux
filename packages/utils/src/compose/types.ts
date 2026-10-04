type AccumulatedResults<
    E extends readonly any[],
    Acc extends any[] = []
> = E extends [infer Head, ...infer Tail]
    ? Head extends (base: any, ...prev: any[]) => infer R
    ? AccumulatedResults<Tail, [...Acc, Awaited<R>]>
    : Acc
    : Acc;

export type ResultsOf<E extends readonly any[]> = AccumulatedResults<E>;

export type ValidEnhancers<TBase, E extends readonly any[], Acc extends any[] = []> =
    E extends [infer Head, ...infer Tail]
    ? [
        (base: TBase, ...prev: Acc) => any,
        ...ValidEnhancers<TBase, Tail, [...Acc, Head extends (base: any, ...prev: any[]) => infer R ? Awaited<R> : never]>
    ]
    : [];
