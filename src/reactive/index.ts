import {
  Target,
  ReactiveFlags,
  TrackOpTypes,
  TriggerOpTypes,
  KeyToDepMap,
  Dep,
  ITERATE_KEY,
  MAP_KEY_ITERATE_KEY,
  ReactiveEffectRunner
} from './types'

const reactiveMap = new WeakMap<Target, any>()

const targetMap = new WeakMap<any, KeyToDepMap>()

let activeEffect: ReactiveEffect | undefined

let shouldTrack: boolean = true

let trackOpBit: number = 1

let effectTrackDepth: number = 0

const maxMarkerBits: number = 30

const initDepMarkers = ({ deps }: ReactiveEffect) => {
  if (deps.length) {
    for (let index = 0; index < deps.length; index++) {
      /**
       * let x = 10 // 10 的二进制表示 1010
       * x |= 5 // 5 的二进制表示 0101，则1010 | 0101 = 1111
       * x // 15
       */
      deps[index].w |= trackOpBit
    }
  }
}

const cleanupEffect = (effect: ReactiveEffect) => {
  const { deps } = effect
  if (deps.length) {
    for (let index = 0; index < deps.length; index++) {
      deps[index].delete(effect)
    }
    deps.length = 0
  }
}

const wasTracked = (dep: Dep) => (dep.w & trackOpBit) > 0

const newTracked = (dep: Dep) => (dep.n & trackOpBit) > 0

const finalizeDepMarks = (effect: ReactiveEffect) => {
  const { deps } = effect
  if (deps.length) {
    let ptr = 0
    for (let index = 0; index < deps.length; index++) {
      const dep = deps[index];
      if (wasTracked(dep) && !newTracked(dep)) {
        dep.delete(effect)
      } else {
        deps[ptr++] = dep
      }
      dep.w &= ~trackOpBit
      dep.n &= ~trackOpBit
    }
    deps.length = ptr
  }
}

export class ReactiveEffect<T = any> {
  active = true
  deps: Dep[] = []
  parent: ReactiveEffect | undefined = undefined

  private deferStop?: boolean

  constructor(public fn: () => T) { }

  run() {
    if (!this.active) {
      return this.fn()
    }
    let parent: ReactiveEffect | undefined = activeEffect
    let lastShouldTrack = shouldTrack
    while (parent) {
      if (parent === this) {
        return
      }
      parent = parent.parent
    }
    try {
      this.parent = activeEffect
      activeEffect = this
      shouldTrack = true

      trackOpBit = 1 << ++effectTrackDepth

      if (effectTrackDepth <= maxMarkerBits) {
        initDepMarkers(this)
      } else {
        cleanupEffect(this)
      }
      return this.fn()
    } finally {
      if (effectTrackDepth <= maxMarkerBits) {
        finalizeDepMarks(this)
      }

      trackOpBit = 1 << --effectTrackDepth
      activeEffect = this.parent
      shouldTrack = lastShouldTrack
      this.parent = undefined

      if (this.deferStop) {
        this.stop()
      }
    }
  }

  stop() {
    if (activeEffect === this) {
      this.deferStop = true
    } else if (this.active) {
      cleanupEffect(this)
      this.active = false
    }
  }
}

function createReactiveObject(
  target: Target,
  isReadonly: boolean,
  baseHandlers: ProxyHandler<any>,
  proxyMap: WeakMap<Target, any>
): Target {
  if (target[ReactiveFlags.RAW] && !(isReadonly && target[ReactiveFlags.IS_REACTIVE])) {
    return target
  }
  const existingProxy = proxyMap.get(target)
  if (existingProxy) {
    return existingProxy
  }

  const proxy = new Proxy(target, baseHandlers)
  proxyMap.set(target, proxy)
  return proxy
}

const createDep = (effects?: ReactiveEffect[]): Dep => {
  const dep = new Set<ReactiveEffect>(effects) as Dep
  dep.w = 0
  dep.n = 0
  return dep
}

function track(target: object, type: TrackOpTypes, key: unknown) {
  if (shouldTrack && activeEffect) {
    let depsMap = targetMap.get(target)
    if (!depsMap) {
      depsMap = new Map()
      targetMap.set(target, depsMap)
    }
    let dep = depsMap.get(key)
    if (!dep) {
      dep = createDep()
      depsMap.set(key, dep)
    }

    trackEffects(dep)
  }

  function trackEffects(dep: Dep) {
    let shouldTrack = false
    if (effectTrackDepth < maxMarkerBits) {
      if (!newTracked(dep)) {
        dep.n |= trackOpBit
        shouldTrack = !wasTracked(dep)
      }
    } else {
      shouldTrack = !dep.has(activeEffect!)
    }

    if (shouldTrack) {
      dep.add(activeEffect!)
      activeEffect!.deps.push(dep)
    }
  }
}

const isIntegerKey = (key: unknown) => typeof key === 'string' && key !== 'NaN' && key[0] !== '-' && '' + parseInt(key, 10) === key

function trigger(
  target: object,
  type: TriggerOpTypes,
  key?: unknown,
  newValue?: unknown,
) {
  const depsMap = targetMap.get(target)
  if (!depsMap) {
    return
  }
  let deps: (Dep | undefined)[] = []
  if (type === TriggerOpTypes.CLEAR) {
    deps = [...depsMap.values()]
  } else if (key === 'length' && Array.isArray(target)) {
    const newLength = Number(newValue)
    depsMap.forEach((dep, key) => {
      if (key === 'length' || key >= newLength) {
        deps.push(dep)
      }
    })
  } else {
    if (key !== void 0) {
      deps.push(depsMap.get(key))
    }

    switch (type) {
      case TriggerOpTypes.ADD:
        if (!Array.isArray(target)) {
          deps.push(depsMap.get(ITERATE_KEY))
          if (Object.prototype.toString.call(target) === '[object Map]') {
            deps.push(depsMap.get(MAP_KEY_ITERATE_KEY))
          }
        } else if (isIntegerKey(key)) {
          deps.push(depsMap.get('length'))
        }
        break
      case TriggerOpTypes.DELETE:
        if (!Array.isArray(target)) {
          deps.push(depsMap.get(ITERATE_KEY))
          if (Object.prototype.toString.call(target) === '[object Map]') {
            deps.push(depsMap.get(MAP_KEY_ITERATE_KEY))
          }
        }
        break
      case TriggerOpTypes.SET:
        if (Object.prototype.toString.call(target) === '[object Map]') {
          deps.push(depsMap.get(ITERATE_KEY))
        }
        break
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
        triggerEffects(createDep(effects))
      }
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
}

export function reactive(target: Target): Target {
  const mutableHandlers: ProxyHandler<object> = {
    get(target: Target, key: string | symbol, receiver: object) {
      const res = Reflect.get(target, key, receiver)
      track(target, TrackOpTypes.GET, key)
      return res
    },
    set(target: Target, key: string | symbol, value: unknown, receiver: object): boolean {
      let oldValue = Reflect.get(target, key, receiver)
      const result = Reflect.set(target, key, value, receiver)
      const hadKey = Object.prototype.hasOwnProperty.call(target, key)
      if (!hadKey) {
        trigger(target, TriggerOpTypes.ADD, key, value)
      } else {
        trigger(target, TriggerOpTypes.SET, key, value)
      }
      return result
    },
  }
  return createReactiveObject(target, false, mutableHandlers, reactiveMap)
}

export function toRaw<T>(observed: T): T {
  const raw = observed && (observed as Target)[ReactiveFlags.RAW]
  return raw ? toRaw(raw) : observed
}

export function effect<T = any>(fn: () => T): ReactiveEffectRunner {
  if ((fn as ReactiveEffectRunner).effect) {
    fn = (fn as ReactiveEffectRunner).effect.fn
  }

  const _effect = new ReactiveEffect(fn)
  _effect.run()
  const runner = _effect.run.bind(_effect) as ReactiveEffectRunner
  runner.effect = _effect
  return runner
}
