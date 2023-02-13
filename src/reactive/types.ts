import { ReactiveEffect } from './index'

export const enum TargetType {
  /** 无效 */
  INVALID = 0,
  /** 普通对象或数组 */
  COMMON = 1,
  /** 集合 */
  COLLECTION = 2
}

export const enum ReactiveFlags {
  SKIP = '__v_skip',
  IS_REACTIVE = '__v_isReactive',
  IS_READONLY = '__v_isReadonly',
  IS_SHALLOW = '__v_isShallow',
  RAW = '__v_raw'
}

export interface Target {
  [ReactiveFlags.SKIP]?: boolean
  [ReactiveFlags.IS_REACTIVE]?: boolean
  [ReactiveFlags.IS_READONLY]?: boolean
  [ReactiveFlags.IS_SHALLOW]?: boolean
  [ReactiveFlags.RAW]?: any
  [key: string | symbol | number]: any
}

export const enum TrackOpTypes {
  GET = 'get',
  HAS = 'has',
  ITERATE = 'iterate'
}

export const enum TriggerOpTypes {
  SET = 'set',
  ADD = 'add',
  DELETE = 'delete',
  CLEAR = 'clear'
}

export type TrackedMarkers = {
  w: number
  n: number
}

export type Dep = Set<ReactiveEffect> & TrackedMarkers

export type KeyToDepMap = Map<any, Dep>

export const ITERATE_KEY = Symbol('iterate')

export const MAP_KEY_ITERATE_KEY = Symbol('Map key iterate')

export interface ReactiveEffectRunner<T = any> {
  (): T
  effect: ReactiveEffect
}
