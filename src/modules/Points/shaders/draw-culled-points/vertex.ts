export const drawCulledPointsVertexWgsl = `
@vertex
fn vertexMain(input: VertexInput, @builtin(instance_index) instanceIdx: u32) -> VertexOutput {
  var output: VertexOutput;
  output.lodAlpha = 1.0;
  output.visualDepth = 0.5;
  let pointIndex = visibleIndices[instanceIdx];
  let status = pointStatusBuf[pointIndex];
  output.isGreyedOut = status.r;
  output.isOutlined = status.g;

  var isHighlighted: f32 = 0.0;
  if (status.r == 0.0) {
    isHighlighted = 1.0;
  }
  if (drawVertex.skipHighlighted > 0.0 && isHighlighted > 0.0) {
    output.position = vec4<f32>(2.0, 2.0, 2.0, 1.0);
    return output;
  }
  if (drawVertex.skipGreyed > 0.0 && isHighlighted <= 0.0) {
    output.position = vec4<f32>(2.0, 2.0, 2.0, 1.0);
    return output;
  }

  let point = mix(previousPositions[pointIndex], positions[pointIndex], drawVertex.renderPositionMix).xy;
  var normalizedPosition = 2.0 * point / drawVertex.spaceSize - vec2<f32>(1.0);
  normalizedPosition = normalizedPosition * (drawVertex.spaceSize / drawVertex.screenSize);
  let finalPosition = drawVertex.transformationMatrix * vec4<f32>(normalizedPosition, 1.0, 1.0);
  let centerClip = finalPosition.xy;

  var pointSize = calculatePointSize(sizes[pointIndex] * drawVertex.sizeScale);
  let visualDepth = visualDepth01(pointIndex, centerClip, pointSize);
  output.visualDepth = visualDepth;
  let depthStrength = clamp(drawVertex.pointDepthCueStrength, 0.0, 1.0);
  if (depthStrength > 0.0) {
    pointSize = pointSize * (1.0 + (visualDepth - 0.5) * 2.0 * drawVertex.pointDepthCueSize * depthStrength);
  }
  if (output.isOutlined > 0.0) {
    pointSize = min(pointSize * outlineRingScale, drawVertex.maxPointSize * drawVertex.ratio);
  }

  let scale = drawVertex.transformationMatrix[0][0];
  let lodWeight = pointLodWeight(scale);
  let minSampleRate = clamp(drawVertex.pointLodMinSampleRate, 0.02, 1.0);
  let sampleRate = mix(1.0, minSampleRate, lodWeight);
  if (lodWeight > 0.0 && output.isOutlined <= 0.0) {
    let h = hash01(pointIndex);
    let feather = max(0.015, 0.12 * lodWeight * (1.0 - sampleRate));
    let sampleAlpha = 1.0 - smoothstep(sampleRate, min(1.0, sampleRate + feather), h);
    if (sampleAlpha <= 0.001) {
      output.position = vec4<f32>(2.0, 2.0, 2.0, 1.0);
      return output;
    }

    let representation = 1.0 / max(sampleRate, 0.02);
    let sizeComp = mix(1.0, min(1.85, sqrt(representation)), lodWeight * drawVertex.pointLodSizeCompensation);
    let alphaComp = mix(1.0, min(2.75, representation), lodWeight * drawVertex.pointLodOpacityCompensation);
    pointSize = pointSize * sizeComp;
    output.lodAlpha = sampleAlpha * alphaComp;
  }

  let halfExtentClip = vec2<f32>(
    pointSize / (drawVertex.screenSize.x * drawVertex.ratio),
    pointSize / (drawVertex.screenSize.y * drawVertex.ratio),
  );
  output.position = vec4<f32>(centerClip + input.quadCorner * halfExtentClip, 0.0, 1.0);
  output.pointCoord = input.quadCorner;

  var shapeColor = colors[pointIndex];
  if (output.isGreyedOut > 0.0) {
    if (drawVertex.greyoutColor[0] != -1.0) {
      shapeColor = drawVertex.greyoutColor;
    } else {
      let blendFactor: f32 = 0.65;
      if (drawVertex.isDarkenGreyout > 0.0) {
        shapeColor = vec4<f32>(mix(shapeColor.rgb, vec3<f32>(0.2), blendFactor), shapeColor.a);
      } else {
        shapeColor = vec4<f32>(
          mix(shapeColor.rgb, max(drawVertex.backgroundColor.rgb, vec3<f32>(0.8)), blendFactor),
          shapeColor.a,
        );
      }
    }
  }
  output.shapeColor = applyDepthToColor(shapeColor, visualDepth);
  return output;
}
`
