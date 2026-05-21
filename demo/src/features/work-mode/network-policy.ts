export interface WorkModeNetworkExplorerPolicy {
  seedEntityInt: number;
  maxNeighbors: number;
  edgeMinScore: number;
  autoJumpOnNodeClick: boolean;
}

export const WORK_MODE_NETWORK_EXPLORER: WorkModeNetworkExplorerPolicy = {
  seedEntityInt: 51197947,
  maxNeighbors: 4000,
  edgeMinScore: 20,
  autoJumpOnNodeClick: true,
}
