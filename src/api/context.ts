export interface Context {};

export type ContextProvider = (req: any) => Promise<Context>;