import type { Buffer, ComputePipeline, Device, Shader, Texture, UniformStore } from '@luma.gl/core'
import type { Model } from '@luma.gl/engine'
import type { GraphConfigInterface } from '@/graph/config/schema'
import type { CorePointsRef } from '@/graph/modules/core-module'
import type { GraphData } from '@/graph/modules/GraphData'
import type { Store } from '@/graph/modules/Store'

export enum LinkDirection {
  OUTGOING = 'outgoing',
  INCOMING = 'incoming'
}

export type ForceLinkUniformStoreShape = {
  forceLinkUniforms: {
    linkSpring: number;
    linkDistance: number;
    linkDistRandomVariationRange: [number, number];
    pointsTextureSize: number;
    linksTextureSize: number;
    alpha: number;
  };
}

export type ForceLinkState = {
  linkFirstIndicesAndAmount: Float32Array;
  indices: Float32Array;
  maxPointDegree: number;
  previousMaxPointDegree: number | undefined;
  previousPointsTextureSize: number | undefined;
  previousLinksTextureSize: number | undefined;
  runCommand: Model | undefined;
  vertexCoordBuffer: Buffer | undefined;
  runComputeShader: Shader | undefined;
  runComputePipeline: ComputePipeline | undefined;
  uniformStore: UniformStore<ForceLinkUniformStoreShape> | undefined;
  uniformBuffer: Buffer | undefined;
  linkFirstIndicesAndAmountTexture: Texture | undefined;
  indicesTexture: Texture | undefined;
  biasAndStrengthTexture: Texture | undefined;
  randomDistanceTexture: Texture | undefined;
}

export type ForceLinkCreateContext = {
  device: Device;
  store: Store;
  data: GraphData;
}

export type ForceLinkSetupContext = {
  device: Device;
  store: Store;
  points: CorePointsRef | undefined;
}

export type ForceLinkRunContext = {
  device: Device;
  config: GraphConfigInterface;
  store: Store;
  points: CorePointsRef | undefined;
}
