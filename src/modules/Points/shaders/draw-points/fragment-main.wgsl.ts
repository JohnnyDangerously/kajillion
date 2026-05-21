export const drawPointsFragmentMainWgsl = `@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  // Discard the fragment if the point is fully transparent and has no image
  if (input.shapeColor.a == 0.0 && input.imageAtlasUV.x == -1.0) {
    discard;
  }

  // Discard the fragment if the point has no shape and no image
  if (input.pointShape == NONE && input.imageAtlasUV.x == -1.0) {
    discard;
  }

  let pointCoord = input.pointCoord;

  // Fast corner-cull for the common no-image circle case. The quad we draw
  // is 2×2 in unit-coord space, but only the inscribed disk (r ≤ 1) is
  // visible. The four corners cover ~21% of the quad footprint and would
  // otherwise burn the full fragment shader (shape distance, fwidth,
  // smoothstep, outline ring math) to produce zero opacity. Discard them
  // immediately. The 1.05² margin keeps the analytic AA edge intact even
  // for the smallest points where one device pixel may extend slightly
  // past r=1; the outline path is excluded because the ring lives outside
  // the disk.
  let rSq = pointCoord.x * pointCoord.x + pointCoord.y * pointCoord.y;
  // When the dataset has no shape/image/outline variation at all, the
  // entire predicate collapses to \`rSq > 1.1025\` — the compiler can drop
  // the four per-instance compares. When the dataset *does* have variants,
  // the per-instance compares stay (we still want to corner-cull individual
  // unadorned circle instances within a mixed dataset).
  let isPlainCircle = (drawFragment.hasNonCircleShapes == 0.0 || input.pointShape == CIRCLE)
                    && (drawFragment.hasImagedPoints == 0.0 || input.imageAtlasUV.x == -1.0)
                    && (drawFragment.hasOutlinedPoints == 0.0 || input.isOutlined == 0.0);
  if (isPlainCircle && rSq > 1.1025) {
    discard;
  }

  // Analytic AA: signed distance from shape edge in unit-coord space.
  // fwidth() must be called in uniform control flow per WGSL spec, so the
  // distance is computed unconditionally at the top of the fragment. The
  // shape branch below just gates whether we use it.
  var shapeCoordForAA = pointCoord;
  if (input.overallSize > input.shapeSize && input.shapeSize > 0.0) {
    let scale = input.shapeSize / input.overallSize;
    shapeCoordForAA = pointCoord / scale;
  }
  // Uniform-gated fast path: when the data contains zero non-circle shapes,
  // the compiler dead-strips the entire shape-distance ladder and uses just
  // the cheap \`length() - 1\` SDF.
  var dAA: f32;
  if (drawFragment.hasNonCircleShapes > 0.0) {
    let distCircle = length(shapeCoordForAA) - 1.0;
    let distShape = getShapeDistance(shapeCoordForAA, input.pointShape);
    let isCircle = select(0.0, 1.0, input.pointShape == CIRCLE);
    dAA = mix(distShape, distCircle, isCircle);
  } else {
    dAA = length(shapeCoordForAA) - 1.0;
  }
  let aaWidth = max(fwidth(dAA), 1e-4);
  let shapeOpacity = 1.0 - smoothstep(-aaWidth, aaWidth, dAA);

  var finalShapeColor = vec4<f32>(0.0);
  var finalImageColor = vec4<f32>(0.0);

  // Handle shape rendering with centering logic
  if (input.pointShape != NONE) {
    finalShapeColor = vec4<f32>(input.shapeColor.rgb, shapeOpacity * input.shapeColor.a);
  }

  // Handle image rendering with centering logic. Outer uniform gate lets
  // the compiler strip the entire image-sampling path when no point in the
  // dataset is imaged.
  if (drawFragment.hasImagedPoints > 0.0) {
    if (input.imageAtlasUV.x != -1.0) {
      var imageCoord = pointCoord;
      if (input.overallSize > input.imageSizeVarying && input.imageSizeVarying > 0.0) {
        let scale = input.imageSizeVarying / input.overallSize;
        imageCoord = pointCoord / scale;

        if (abs(imageCoord.x) > 1.0 || abs(imageCoord.y) > 1.0) {
          finalImageColor = vec4<f32>(0.0);
        } else {
          let atlasUV = mix(input.imageAtlasUV.xy, input.imageAtlasUV.zw, (imageCoord + vec2<f32>(1.0)) * 0.5);
          finalImageColor = applyGreyoutToImage(sampleAtlas(atlasUV), input.isGreyedOut);
        }
      } else {
        let atlasUV = mix(input.imageAtlasUV.xy, input.imageAtlasUV.zw, (imageCoord + vec2<f32>(1.0)) * 0.5);
        finalImageColor = applyGreyoutToImage(sampleAtlas(atlasUV), input.isGreyedOut);
      }
    }
  }

  var finalPointAlpha = max(finalShapeColor.a, finalImageColor.a);
  if (input.isGreyedOut > 0.0 && drawFragment.greyoutOpacity != -1.0) {
    finalPointAlpha = finalPointAlpha * drawFragment.greyoutOpacity;
  } else {
    finalPointAlpha = finalPointAlpha * drawFragment.pointOpacity;
  }
  finalPointAlpha = min(1.0, finalPointAlpha * input.lodAlpha);

  // Blend image color above point color
  var fragColor = vec4<f32>(
    mix(finalShapeColor.rgb, finalImageColor.rgb, finalImageColor.a),
    finalPointAlpha,
  );

  let depthStrength = clamp(drawVertex.pointDepthCueStrength, 0.0, 1.0);
  if (depthStrength > 0.0 && input.pointShape == CIRCLE && input.imageAtlasUV.x == -1.0) {
    let z = clamp(input.visualDepth, 0.0, 1.0);
    let r = length(shapeCoordForAA);
    let highlightCenter = vec2<f32>(-0.34, -0.42);
    let highlight = (1.0 - smoothstep(0.0, 0.58, distance(shapeCoordForAA, highlightCenter))) * shapeOpacity;
    let lowerShadow = smoothstep(0.05, 0.78, dot(shapeCoordForAA, normalize(vec2<f32>(0.36, 0.78)))) * shapeOpacity;
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

  // Dense graph views need a cheap figure/ground cue, but the explicit
  // outline-ring path is too visually heavy for thousands of nodes. Add an
  // in-disc moat/rim for plain circles so crowded clusters keep separation.
  if (input.pointShape == CIRCLE && input.isOutlined <= 0.0 && input.imageAtlasUV.x == -1.0) {
    let bgLuma = dot(drawFragment.backgroundColor.rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
    let rim = smoothstep(0.62, 0.98, length(shapeCoordForAA)) * shapeOpacity;
    let rimColor = select(vec3<f32>(0.0, 0.0, 0.0), vec3<f32>(0.055, 0.070, 0.095), bgLuma > 0.78);
    let rimOpacity = rim * (0.24 + select(0.0, 0.12, bgLuma > 0.78)) * finalPointAlpha;
    fragColor = vec4<f32>(
      mix(fragColor.rgb, rimColor, rimOpacity),
      fragColor.a,
    );
  }

  // Render outline ring around the point. Outer uniform gate lets the
  // compiler strip the entire ring-AA path when no point is outlined.
  if (drawFragment.hasOutlinedPoints > 0.0 && input.isOutlined > 0.0) {
    let r = length(pointCoord);
    let ringSmoothing: f32 = 1.025;
    let rSafe = max(r, 1e-6);
    let wSafe = max(drawFragment.outlineWidth, 1e-6);
    let outerEdge = smoothstep(rSafe, rSafe * ringSmoothing, 1.0);
    let innerEdge = smoothstep(wSafe, wSafe * ringSmoothing, r);
    let ringAlpha = outerEdge * innerEdge;

    // Grey out the ring color when the point is greyed
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
    // Composite ring on top of existing fragment
    fragColor = vec4<f32>(
      mix(fragColor.rgb, ringColor, ringOpacity),
      max(fragColor.a, ringOpacity),
    );
  }

  // Premultiplied alpha: pair with blend (one, one-minus-src-alpha). Stacks
  // of translucent nodes composite correctly without dark halos. Equivalent
  // math to alpha-over when used with the correct blend factors.
  return vec4<f32>(fragColor.rgb * fragColor.a, fragColor.a);
}`
