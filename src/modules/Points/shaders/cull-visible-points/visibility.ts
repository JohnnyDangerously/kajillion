export const cullVisiblePointsVisibilityWgsl = `
fn priorityForPoint(i: u32, pointSize: f32, status: vec4<f32>, pixel: vec2<f32>) -> u32 {
  let tileJitter = hashU32(i) & 511u;
  let statusScore = select(0u, 1024u, status.g > 0.0);
  let sizeScore = u32(clamp(pointSize * 1.4, 0.0, 130.0));
  let score = min(statusScore + sizeScore + tileJitter, 2047u);
  let tie = hashU32(i) & priorityTieMask;
  return (score << priorityScoreShift) | tie;
}

fn tileBudgetSlotForPoint(i: u32) -> u32 {
  return hashU32(i) % max(cullUniforms.tileBudgetSlots, 1u);
}

fn selectedByTileBudget(tileIndex: u32, priority: u32) -> bool {
  if (cullUniforms.tileBudget == 0u) {
    return true;
  }
  let slots = min(min(cullUniforms.tileBudget, cullUniforms.tileBudgetSlots), maxTileBudgetSlots);
  let base = tileIndex * cullUniforms.tileBudgetSlots;
  var selected = false;
  for (var slot = 0u; slot < maxTileBudgetSlots; slot = slot + 1u) {
    if (slot < slots && atomicLoad(&tileBudgetPriorities[base + slot]) == priority) {
      selected = true;
    }
  }
  return selected;
}

fn evaluatePointVisibility(i: u32) -> PointVisibility {
  var result = PointVisibility(0u, 0u, 0u);
  if (i < cullUniforms.pointCount) {
    if (cullUniforms.activeMaskEnabled > 0.0 && activeMask[i] == 0u) {
      return result;
    }
    let point = mix(previousPositions[i], positions[i], cullUniforms.renderPositionMix).xy;
    var normalizedPosition = 2.0 * point / cullUniforms.spaceSize - vec2<f32>(1.0);
    normalizedPosition = normalizedPosition * (cullUniforms.spaceSize / cullUniforms.screenSize);
    let finalPosition = cullUniforms.transformationMatrix * vec4<f32>(normalizedPosition, 1.0, 1.0);
    let centerClip = finalPosition.xy;

    let status = pointStatusBuf[i];
    var pointSize = calculatePointSize(sizes[i] * cullUniforms.sizeScale);
    if (status.g > 0.0) {
      pointSize = min(pointSize * outlineRingScale, cullUniforms.maxPointSize * cullUniforms.ratio);
    }

    var rejected = false;
    let scale = cullUniforms.transformationMatrix[0][0];
    let lodWeight = pointLodWeight(scale);
    let minSampleRate = clamp(cullUniforms.pointLodMinSampleRate, 0.02, 1.0);
    let sampleRate = mix(1.0, minSampleRate, lodWeight);
    if (lodWeight > 0.0 && status.g <= 0.0) {
      let h = hash01(i);
      let feather = max(0.015, 0.12 * lodWeight * (1.0 - sampleRate));
      let sampleAlpha = 1.0 - smoothstep(sampleRate, min(1.0, sampleRate + feather), h);
      if (sampleAlpha <= 0.001) {
        rejected = true;
      }

      let representation = 1.0 / max(sampleRate, 0.02);
      let sizeComp = mix(1.0, min(1.85, sqrt(representation)), lodWeight * cullUniforms.pointLodSizeCompensation);
      pointSize = pointSize * sizeComp;
    }

    if (cullUniforms.pointMinPixelSize > 0.0 && pointSize < cullUniforms.pointMinPixelSize) {
      rejected = true;
    }

    // Use the actual sprite size for the frustum margin. This avoids keeping
    // every near-edge point alive just because the device supports a large
    // maxPointSize.
    let cullMargin = 2.0 * vec2<f32>(pointSize) / (cullUniforms.screenSize * cullUniforms.ratio);
    if (abs(centerClip.x) > 1.0 + cullMargin.x || abs(centerClip.y) > 1.0 + cullMargin.y) {
      rejected = true;
    }
    if (!rejected) {
      let pixel = screenPixelFromClip(centerClip);
      let tileIndex = tileIndexForPixel(pixel);
      result.keep = 1u;
      result.tileIndex = tileIndex;
      result.priority = priorityForPoint(i, pointSize, status, pixel);
    }
  }
  return result;
}

fn pointIsVisible(i: u32) -> bool {
  let visibility = evaluatePointVisibility(i);
  return visibility.keep > 0u && selectedByTileBudget(visibility.tileIndex, visibility.priority);
}
`
