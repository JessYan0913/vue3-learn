export type Dep = Set<ReactiveEffect> & {
  /** wasTracked */
  w: number;
  /** newTracked */
  n: number;
}

export type Effect<T> = (...args: any[]) => T

let activeEffect: ReactiveEffect | undefined

let shouldTrack: boolean = true

let effectTrackDepth = 0

let trackOpBit = 1

const maxMarkerBits = 30

export const reactiveMap = new WeakMap()

export const targetMap = new WeakMap()

class ReactiveEffect<T = any> {
  public active: boolean = true
  public deps: Dep[]
  public effect: Effect<T> | undefined
  public computed: boolean = true

  constructor(effect: Effect<T>) {
    this.effect = effect
    this.deps = []
  }

  run(...args: any[]) {
    if (!this.active) {
      return;
    }
    if (this.effect) {
      this.effect(...args)
    }
  }

  addDep(dep: Dep) {
    this.deps.push(dep)
  }

  teardown() {
    this.deps = []
    this.effect = undefined
    this.active = false
  }
}

function track<T extends object>(target: T, key: string) {
  if (shouldTrack && activeEffect) {
    let depsMap = targetMap.get(target)
    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()))
    }
    let dep = depsMap.get(key)
    if (!dep) {
      depsMap.set(key, (dep = createDep()))
    }
    trackEffects(dep)
  }
}

function createDep(effects?: ReactiveEffect[]): Dep {
  const dep = new Set<ReactiveEffect>(effects) as Dep
  dep.w = 0
  dep.n = 0
  return dep
}

const newTracked = (dep: Dep): boolean => (dep.n & trackOpBit) > 0

const wasTracked = (dep: Dep): boolean => (dep.w & trackOpBit) > 0

function trackEffects(dep: Dep) {
  let shouldTrack = false
  if (effectTrackDepth <= maxMarkerBits) {
    if (!newTracked(dep)) {
      dep.n |= trackOpBit
      shouldTrack = wasTracked(dep)
    }
  } else {
    shouldTrack = !dep.has(activeEffect!)
  }

  if (shouldTrack) {
    dep.add(activeEffect!)
    activeEffect!.deps.push(dep)
  }
}

const ITERATE_KEY = Symbol('iterate')

function trigger<T extends object>(target: T, type: string, key?: unknown, newValue?: unknown, oldValue?: unknown, oldTarget?: Map<unknown, unknown> | Set<unknown>) {
  const depsMap = targetMap.get(target)
  if (!depsMap) {
    return
  }
  let deps: (Dep | undefined)[] = []
  if (key !== void 0) {
    deps.push(depsMap.get(key))
  }
  switch (type) {
    case 'add':
      deps.push(depsMap.get(ITERATE_KEY))
      break;
    case 'set':
      if (target instanceof Map) {
        deps.push(depsMap.get(ITERATE_KEY))
      }
      break;
  }
  if (deps.length === 1) {
    if (deps[0]) {
      triggerEffects(deps[0])
    }
  } else {
    const effects: ReactiveEffect[] = []
    for (const dep of deps) {
      if (dep) {
        effects.push(...dep)
      }
    }
    triggerEffects(effects)
  }
}

function triggerEffects(dep: Dep | ReactiveEffect[]) {
  const effects = Array.isArray(dep) ? dep : [...dep]
  for (const effect of effects) {
    triggerEffect(effect)
  }
}

function triggerEffect(effect: ReactiveEffect) {
  if (effect !== activeEffect) {
    effect.run()
  }
}

export function createReactiveObject<T extends object>(target: T, handlers: ProxyHandler<T>): T {
  const existingProxy = reactiveMap.get(target)
  if (existingProxy) {
    return existingProxy
  }

  const proxy = new Proxy<T>(target, handlers)
  reactiveMap.set(target, proxy)
  return proxy
}

export function reactive<T extends object>(target: T): T {
  return createReactiveObject(target, baseHandlers<T>())

  function baseHandlers<T extends object>(): ProxyHandler<T> {
    return {
      get(target: T, p: string, receiver: any) {
        const res = Reflect.get(target, p, receiver);
        track(target, p)
        return res
      },
      set(target, p, newValue, receiver) {
        let oldValue = Reflect.get(target, p, reactive)
        const hasKey = Reflect.has(target, p)
        const res = Reflect.set(target, p, newValue, receiver)
        if (!hasKey) {
          trigger(target, 'add', p, newValue)
        } else {
          trigger(target, 'set', p, newValue, oldValue)
        }
        return res
      },
    }
  }
}
