export declare function start(): Promise<number>;
export declare function servePage(html: string): {
    id: string;
    url: string;
};
export declare function cleanupPage(id: string): void;
