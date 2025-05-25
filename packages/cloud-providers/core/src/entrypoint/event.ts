import { BaseEntry } from "./base";

// Comparison operators
interface ComparisonOperators {
    $eq?: any;
    $ne?: any;
    $gt?: number | string | Date;
    $gte?: number | string | Date;
    $lt?: number | string | Date;
    $lte?: number | string | Date;
}

// Array operators
interface ArrayOperators {
    $in?: any[];
    $nin?: any[];
    $all?: any[];
    $size?: number;
}

// String operators
interface StringOperators {
    $regex?: string;
    $startsWith?: string;
    $endsWith?: string;
    $contains?: string;
}

// Existence and type operators
interface ExistenceOperators {
    $exists?: boolean;
    $type?: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null' | 'undefined';
}

// Logical operators
interface LogicalOperatorAnd {
    $and: FilterCondition[];
}

interface LogicalOperatorOr {
    $or: FilterCondition[];
}

type LogicalOperators = LogicalOperatorAnd | LogicalOperatorOr;

// Combined operator types
type FilterCondition =
    | ComparisonOperators
    | ArrayOperators
    | StringOperators
    | ExistenceOperators
    | LogicalOperators;

// Filter property can be a direct value or a condition object
type FilterPropertyValue = any | FilterCondition;

// The full filter type definition
export type MessageFilter = {
    [propertyPath: string]: FilterPropertyValue;
};

export type EventTrigger = {
    type: "event",
    options: {
        source: string,
        sourceType: string
        filter?: MessageFilter;
    }
}

export type EventEntry = BaseEntry<EventTrigger>