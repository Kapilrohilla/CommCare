export interface AriChannel{
    id: string;
    name: string;
    state: string;
    caller: {
        name: string;
        number: string;
    };
}