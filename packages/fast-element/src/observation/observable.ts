import { Controller } from "../controller";
import { FastElement } from "../fast-element";
import { Notifier, PropertyChangeNotifier } from "./notifier";
import { Expression, ExpressionContext, emptyArray } from "../interfaces";

export interface GetterInspector {
    inspect(source: unknown, propertyName: string): void;
}

const notifierLookup = new WeakMap<any, Notifier>();
let currentInspector: GetterInspector | undefined = void 0;

export const Observable = {
    setInspector(inspector: GetterInspector) {
        currentInspector = inspector;
    },

    clearInspector() {
        currentInspector = void 0;
    },

    createArrayObserver(array: any[]): Notifier {
        throw new Error("Must call enableArrayObservation before observing arrays.");
    },

    getNotifier<T extends Notifier = Notifier>(source: any): T {
        let found = source.$controller || notifierLookup.get(source);

        if (found === void 0) {
            if (source instanceof FastElement) {
                found = Controller.forCustomElement(source);
            } else if (Array.isArray(source)) {
                found = Observable.createArrayObserver(source);
            } else {
                notifierLookup.set(source, (found = new PropertyChangeNotifier()));
            }
        }

        return found;
    },

    track(source: unknown, propertyName: string) {
        if (currentInspector !== void 0) {
            currentInspector.inspect(source, propertyName);
        }
    },

    notify(source: unknown, args: any) {
        Observable.getNotifier(source).notify(source, args);
    },

    define(target: {}, propertyName: string) {
        const fieldName = `_${propertyName}`;
        const callbackName = `${propertyName}Changed`;
        const hasCallback = callbackName in target;

        const observedProperties =
            (target as any).observedProperties ||
            ((target as any).observedProperties = []);
        observedProperties.push(propertyName);

        Reflect.defineProperty(target, propertyName, {
            enumerable: true,
            get: function(this: any) {
                Observable.track(this, propertyName);
                return this[fieldName];
            },
            set: function(this: any, newValue) {
                const oldValue = this[fieldName];

                if (oldValue !== newValue) {
                    this[fieldName] = newValue;

                    if (hasCallback) {
                        this[callbackName](oldValue, newValue);
                    }

                    Observable.notify(this, propertyName);
                }
            },
        });
    },

    getObservedProperties(target: {}): string[] {
        return (target as any).observedProperties || emptyArray;
    },
};

export function observable($target: {}, $prop: string) {
    Observable.define($target, $prop);
}

export function inspectAndEvaluate<T = unknown>(
    expression: Expression,
    scope: unknown,
    context: ExpressionContext,
    inspector: GetterInspector
): T {
    Observable.setInspector(inspector);
    const value = expression(scope, context);
    Observable.clearInspector();
    return value as T;
}
