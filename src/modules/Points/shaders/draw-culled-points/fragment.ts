export const drawCulledPointsFragmentWgsl = `
@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let rSq = dot(input.pointCoord, input.pointCoord);
  if (rSq > 1.1025 && !(drawFragment.hasOutlinedPoints > 0.0 && input.isOutlined > 0.0)) {
    discard;
  }

  let innerRadius = clamp(input.shapeSize / max(input.overallSize, 1e-4), 0.0, 1.0);
  let shapeCoord = input.pointCoord / max(innerRadius, 1e-4);
  let dAA = length(shapeCoord) - 1.0;
  let aaWidth = max(fwidth(dAA), 1e-4);
  let shapeOpacity = 1.0 - smoothstep(-aaWidth, aaWidth, dAA);

  var finalPointAlpha = shapeOpacity * input.shapeColor.a;
  if (input.isGreyedOut > 0.0 && drawFragment.greyoutOpacity != -1.0) {
    finalPointAlpha = finalPointAlpha * drawFragment.greyoutOpacity;
  } else {
    finalPointAlpha = finalPointAlpha * drawFragment.pointOpacity;
  }
  finalPointAlpha = min(1.0, finalPointAlpha * input.lodAlpha);

  var fragColor = vec4<f32>(input.shapeColor.rgb, finalPointAlpha);

  let depthStrength = clamp(drawVertex.pointDepthCueStrength, 0.0, 1.0);
  if (depthStrength > 0.0) {
    let z = clamp(input.visualDepth, 0.0, 1.0);
    let r = length(input.pointCoord);
    let highlightCenter = vec2<f32>(-0.34, -0.42);
    let highlight = (1.0 - smoothstep(0.0, 0.58, distance(input.pointCoord, highlightCenter))) * shapeOpacity;
    let lowerShadow = smoothstep(0.05, 0.78, dot(input.pointCoord, normalize(vec2<f32>(0.36, 0.78)))) * shapeOpacity;
    let near = smoothstep(0.40, 1.0, z);
    let far = 1.0 - near;
    let highlightMix = highlight * near * depthStrength * clamp(drawVertex.pointDepthCueHighlight, 0.0, 1.0);
    let moatMix = smoothstep(0.58, 1.02, r) * (0.45 + near * 0.55) * drawVertex.pointDepthCueMoat * depthStrength * shapeOpacity;
    let shadowMix = lowerShadow * (0.30 + far * 0.18) * clamp(drawVertex.pointDepthCueShadow, 0.0, 1.0) * depthStrength * shapeOpacity;
    fragColor = vec4<f32>(
      mix(fragColor.rgb, vec3<f32>(1.0), highlightMix),
      fragColor.a,
    );
    fragColor = vec4<f32>(
      mix(fragColor.rgb, fragColor.rgb * 0.72, shadowMix + moatMix * 0.45),
      fragColor.a,
    );
  }

  if (drawVertex.pointBorderTreatment > 0.5 && input.isOutlined <= 0.0) {
    let bgLuma = dot(drawFragment.backgroundColor.rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
    let rawRadius = length(input.pointCoord);
    let outerRing = (1.0 - smoothstep(0.98, 1.0, rawRadius)) * smoothstep(innerRadius - 0.045, innerRadius + 0.025, rawRadius);
    let innerRim = smoothstep(0.70, 0.80, length(shapeCoord)) * shapeOpacity;
    let mode = drawVertex.pointBorderTreatment;
    let darkSource = input.shapeColor.rgb * 0.42;
    let darkNeutral = select(vec3<f32>(0.0), vec3<f32>(0.045, 0.052, 0.064), bgLuma > 0.78);
    let isDarker = mode > 1.5 && mode < 2.5;
    let isShadow = mode > 2.5 && mode < 3.5;
    let isBoth = mode > 3.5;
    let rimColor = select(darkNeutral, darkSource, isDarker || isShadow);
    let lowerBias = smoothstep(-0.18, 0.84, input.pointCoord.y) * shapeOpacity;
    let outerOpacity = select(outerRing * 0.95, outerRing * 0.88, isBoth) * select(1.0, 0.0, isShadow);
    let innerOpacity = innerRim * select(0.46, 0.62, isDarker || isBoth) + lowerBias * select(0.0, 0.38, isShadow);
    let rimOpacity = (outerOpacity + innerOpacity) * input.shapeColor.a;
    let mixedRimColor = select(rimColor, darkSource, isBoth && innerRim > outerRing);
    fragColor = vec4<f32>(
      mix(fragColor.rgb, mixedRimColor, min(1.0, rimOpacity)),
      max(fragColor.a, outerOpacity * input.shapeColor.a),
    );
  }

  if (drawFragment.hasOutlinedPoints > 0.0 && input.isOutlined > 0.0) {
    let r = length(input.pointCoord);
    let ringSmoothing: f32 = 1.025;
    let rSafe = max(r, 1e-6);
    let wSafe = max(drawFragment.outlineWidth, 1e-6);
    let outerEdge = smoothstep(rSafe, rSafe * ringSmoothing, 1.0);
    let innerEdge = smoothstep(wSafe, wSafe * ringSmoothing, r);
    let ringAlpha = outerEdge * innerEdge;

    var ringColor = drawFragment.outlineColor.rgb;
    if (input.isGreyedOut > 0.0) {
      let blendFactor: f32 = 0.65;
      if (drawFragment.isDarkenGreyout > 0.0) {
        ringColor = mix(ringColor, vec3<f32>(0.2), blendFactor);
      } else {
        ringColor = mix(ringColor, max(drawFragment.backgroundColor.rgb, vec3<f32>(0.8)), blendFactor);
      }
    }

    let ringOpacity = ringAlpha * drawFragment.outlineColor.a;
    fragColor = vec4<f32>(
      mix(fragColor.rgb, ringColor, ringOpacity),
      max(fragColor.a, ringOpacity),
    );
  }

  return vec4<f32>(fragColor.rgb * fragColor.a, fragColor.a);
}
`
