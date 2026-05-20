export const drawPointsVertexWgsl = `@vertex
fn vertexMain(input: VertexInput, @builtin(instance_index) instanceIdx: u32) -> VertexOutput {
  var output: VertexOutput;
  output.pointShape = 0.0;
  output.isGreyedOut = 0.0;
  output.isOutlined = 0.0;
  output.shapeColor = vec4<f32>(0.0);
  output.imageAtlasUV = vec4<f32>(-1.0);
  output.shapeSize = 0.0;
  output.imageSizeVarying = 0.0;
  output.overallSize = 0.0;
  output.lodAlpha = 1.0;
  output.visualDepth = 0.5;

  let uv = (input.pointIndices + vec2<f32>(0.5)) / drawVertex.pointsTextureSize;

  // Read point status (R = greyout, G = outlined) via storage buffer to
  // avoid vertex-stage textureSampleLevel — the same TBDR pathology that
  // motivated the positions→storage migration. The CPU host writes the
  // same RGBA32F state to both the texture and the buffer.
  let status = pointStatusBuf[instanceIdx];
  output.isGreyedOut = status.r;
  output.isOutlined = status.g;
  var isHighlighted: f32 = 0.0;
  if (status.r == 0.0) {
    isHighlighted = 1.0;
  }

  // Discard point based on rendering mode
  if (drawVertex.skipHighlighted > 0.0 && isHighlighted > 0.0) {
    output.position = vec4<f32>(2.0, 2.0, 2.0, 1.0);
    return output;
  }
  if (drawVertex.skipGreyed > 0.0 && isHighlighted <= 0.0) {
    output.position = vec4<f32>(2.0, 2.0, 2.0, 1.0);
    return output;
  }

  // Position via storage-buffer vertex-pulling. The sim writes
  // currentPositionTexture; renderFrame copies it to \`positions\` once per
  // frame before draw. Indexing by instance avoids per-vertex texture sampling.
  let pointPosition = mix(previousPositions[instanceIdx], positions[instanceIdx], drawVertex.renderPositionMix);
  let point = pointPosition.rg;

  // Transform point position to normalized device coordinates
  var normalizedPosition = 2.0 * point / drawVertex.spaceSize - vec2<f32>(1.0);
  normalizedPosition = normalizedPosition * (drawVertex.spaceSize / drawVertex.screenSize);

  // Equivalent to mat3(transformationMatrix) * vec3(normalizedPosition, 1)
  let finalPosition = drawVertex.transformationMatrix * vec4<f32>(normalizedPosition, 1.0, 1.0);
  let centerClip = vec2<f32>(finalPosition.xy);

  // Frustum cull: skip points whose sprite is entirely offscreen.
  let cullMargin = 2.0 * vec2<f32>(drawVertex.maxPointSize) / drawVertex.screenSize;
  if (abs(centerClip.x) > 1.0 + cullMargin.x || abs(centerClip.y) > 1.0 + cullMargin.y) {
    output.position = vec4<f32>(2.0, 2.0, 2.0, 1.0);
    return output;
  }

  // Calculate sizes for shape and image
  var shapeSizeValue = calculatePointSize(input.size * drawVertex.sizeScale);
  var imageSizeValue = calculatePointSize(input.imageSize * drawVertex.sizeScale);

  // Use the larger of the two sizes for the overall point size
  var overallSizeValue = max(shapeSizeValue, imageSizeValue);
  let visualDepth = visualDepth01(instanceIdx, centerClip, overallSizeValue);
  output.visualDepth = visualDepth;
  let depthStrength = clamp(drawVertex.pointDepthCueStrength, 0.0, 1.0);
  if (depthStrength > 0.0) {
    let depthSize = 1.0 + (visualDepth - 0.5) * 2.0 * drawVertex.pointDepthCueSize * depthStrength;
    shapeSizeValue = shapeSizeValue * depthSize;
    imageSizeValue = imageSizeValue * depthSize;
    overallSizeValue = overallSizeValue * depthSize;
  }

  // Scale up point sprite to fit outline ring; clamp to hardware gl_PointSize limit.
  if (output.isOutlined > 0.0) {
    overallSizeValue = overallSizeValue * outlineRingScale;
    overallSizeValue = min(overallSizeValue, drawVertex.maxPointSize * drawVertex.ratio);
  }

  let scale = drawVertex.transformationMatrix[0][0];
  let lodWeight = pointLodWeight(scale);
  let minSampleRate = clamp(drawVertex.pointLodMinSampleRate, 0.02, 1.0);
  let sampleRate = mix(1.0, minSampleRate, lodWeight);
  if (lodWeight > 0.0 && output.isOutlined <= 0.0 && input.imageIndex < 0.0) {
    let h = hash01(instanceIdx);
    let feather = max(0.015, 0.12 * lodWeight * (1.0 - sampleRate));
    let sampleAlpha = 1.0 - smoothstep(sampleRate, min(1.0, sampleRate + feather), h);
    if (sampleAlpha <= 0.001) {
      output.position = vec4<f32>(2.0, 2.0, 2.0, 1.0);
      return output;
    }

    let representation = 1.0 / max(sampleRate, 0.02);
    let sizeComp = mix(1.0, min(1.85, sqrt(representation)), lodWeight * drawVertex.pointLodSizeCompensation);
    let alphaComp = mix(1.0, min(2.75, representation), lodWeight * drawVertex.pointLodOpacityCompensation);
    shapeSizeValue = shapeSizeValue * sizeComp;
    imageSizeValue = imageSizeValue * sizeComp;
    overallSizeValue = overallSizeValue * sizeComp;
    output.lodAlpha = sampleAlpha * alphaComp;
  }

  // Hard-skip rendering when the final sprite size is below the configured threshold.
  if (drawVertex.pointMinPixelSize > 0.0 && overallSizeValue < drawVertex.pointMinPixelSize) {
    output.position = vec4<f32>(2.0, 2.0, 2.0, 1.0);
    return output;
  }

  // Expand the instance into a screen-aligned quad. quadCorner is [-1,1]^2;
  // half-extent in clip space is sizePx / framebufferSize, and framebufferSize
  // = screenSize * ratio (screenSize is CSS pixels, sizes are device pixels).
  let halfExtentClip = vec2<f32>(
    overallSizeValue / (drawVertex.screenSize.x * drawVertex.ratio),
    overallSizeValue / (drawVertex.screenSize.y * drawVertex.ratio),
  );
  output.position = vec4<f32>(centerClip + input.quadCorner * halfExtentClip, 0.0, 1.0);
  output.pointCoord = input.quadCorner;

  // Pass size information to fragment shader
  output.shapeSize = shapeSizeValue;
  output.imageSizeVarying = imageSizeValue;
  output.overallSize = overallSizeValue;

  var shapeColor = input.color;
  output.pointShape = input.shape;

  // Adjust color of greyed-out points
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

  if (drawVertex.hasImages <= 0.0 || input.imageIndex < 0.0 || input.imageIndex >= drawVertex.imageCount) {
    output.imageAtlasUV = vec4<f32>(-1.0);
  } else {
    let atlasCoordIndex = input.imageIndex;
    let atlasTexSize = drawVertex.imageAtlasCoordsTextureSize;
    let texX = atlasCoordIndex - atlasTexSize * floor(atlasCoordIndex / atlasTexSize);
    let texY = floor(atlasCoordIndex / atlasTexSize);
    let atlasCoordTexCoord = (vec2<f32>(texX, texY) + vec2<f32>(0.5)) / atlasTexSize;
    let atlasCoords = textureSampleLevel(imageAtlasCoords, imageAtlasCoordsSampler, atlasCoordTexCoord, 0.0);
    output.imageAtlasUV = atlasCoords;
  }

  return output;
}`
