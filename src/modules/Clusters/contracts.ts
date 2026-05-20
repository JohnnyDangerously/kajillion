export type CalculateCentermassUniformStoreShape = {
  calculateCentermassUniforms: {
    pointsTextureSize: number;
    clustersTextureSize: number;
  };
}

export type ApplyForcesUniformStoreShape = {
  applyForcesUniforms: {
    alpha: number;
    clustersTextureSize: number;
    clusterCoefficient: number;
  };
}

export type ClusterTextureState = {
  clusterState: Float32Array;
  clusterPositions: Float32Array;
  clusterForceCoefficient: Float32Array;
}
