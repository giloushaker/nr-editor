export interface Profile {
    Name: string,
    Stats: {
        M: string,
        WS: string,
        BS: string,
        S: string,
        T: string,
        W: string,
        I: string,
        A: string,
        Ld: string,
        Points: string
    }
}
export interface Unit {
    Name: string,
    "Points": null,
    "Profiles": Profile[],
    "Subheadings": {
        "Armour Value:": string,
        "Special Rules:"?: string,
        "Options:"?: string,
        "Equipment:"?: string,
        "Unit Size:"?: string,
        "Base Size:"?: string,
        "Troop Type:"?: string
        "Magic:"?: string
    },
    // "Unit Text": string
}
export interface Page {
    page_type: null | string,
    "Units": Unit[],
    "Special Rules": Record<string, string>
    "Weapons": Weapon[],
}

export interface Weapon {
    "Name": string,
    "Stats": {
        "R": string,
        "S": string,
        "AP": string,
        "Special Rules": string,
        "Notes": string,
    }
}
export interface SpecialRule {
    name: string;
    description: string;
}
export type NoId<T> = Omit<T, "id">
export type NoTarget<T> = Omit<T, "target">
export type ParsedUnitText = Record<string, string> & {
    specialRuleDefinitions?: SpecialRule[],
    weaponTables?: Array<{ rows: Weapon[] }>
}

export interface Equipment {
    text: string
    details: string | null
}


export interface EntyTemplate {
    name: string;
    profile: Profile;
    specialRules: SpecialRule[];
    equipment: string[];
    baseSize: string | null;
    unitSize: string | null;
    troopType: string | null;
}

