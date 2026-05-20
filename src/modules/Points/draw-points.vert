#version 300 es
#ifdef GL_ES
precision highp float;
#endif

in vec2 pointIndices;
in float size;
in vec4 color;
in float shape;
in float imageIndex;
in float imageSize;

uniform sampler2D positionsTexture;
uniform sampler2D pointStatus;
uniform sampler2D imageAtlasCoords;

#ifdef USE_UNIFORM_BUFFERS
layout(std140) uniform drawVertexUniforms {
  float ratio;
  mat4 transformationMatrix;
  float pointsTextureSize;
  float sizeScale;
  float spaceSize;
  vec2 screenSize;
  vec4 greyoutColor;
  vec4 backgroundColor;
  float scalePointsOnZoom;
  float maxPointSize;
  float isDarkenGreyout;
  float skipHighlighted;
  float skipGreyed;
  float hasImages;
  float imageCount;
  float imageAtlasCoordsTextureSize;
  float pointMinPixelSize;
  float pointDepthCueStrength;
  float pointDepthCueSize;
  float pointDepthCueBrightness;
  float pointDepthCueOpacity;
  float pointDepthCueMoat;
  float pointDepthCueHighlight;
  float pointDepthCueShadow;
  float pointDepthCueSaturation;
} drawVertex;

#define ratio drawVertex.ratio
#define transformationMatrix drawVertex.transformationMatrix
#define pointsTextureSize drawVertex.pointsTextureSize
#define sizeScale drawVertex.sizeScale
#define spaceSize drawVertex.spaceSize
#define screenSize drawVertex.screenSize
#define greyoutColor drawVertex.greyoutColor
#define backgroundColor drawVertex.backgroundColor
#define scalePointsOnZoom drawVertex.scalePointsOnZoom
#define maxPointSize drawVertex.maxPointSize
#define isDarkenGreyout drawVertex.isDarkenGreyout
#define skipHighlighted drawVertex.skipHighlighted
#define skipGreyed drawVertex.skipGreyed
#define hasImages drawVertex.hasImages
#define imageCount drawVertex.imageCount
#define imageAtlasCoordsTextureSize drawVertex.imageAtlasCoordsTextureSize
#define pointMinPixelSize drawVertex.pointMinPixelSize
#define pointDepthCueStrength drawVertex.pointDepthCueStrength
#define pointDepthCueSize drawVertex.pointDepthCueSize
#define pointDepthCueBrightness drawVertex.pointDepthCueBrightness
#define pointDepthCueOpacity drawVertex.pointDepthCueOpacity
#define pointDepthCueMoat drawVertex.pointDepthCueMoat
#define pointDepthCueHighlight drawVertex.pointDepthCueHighlight
#define pointDepthCueShadow drawVertex.pointDepthCueShadow
#define pointDepthCueSaturation drawVertex.pointDepthCueSaturation
#else
uniform float ratio;
uniform mat3 transformationMatrix;
uniform float pointsTextureSize;
uniform float sizeScale;
uniform float spaceSize;
uniform vec2 screenSize;
uniform vec4 greyoutColor;
uniform vec4 backgroundColor;
uniform float scalePointsOnZoom;
uniform float maxPointSize;
uniform float isDarkenGreyout;
uniform float skipHighlighted;
uniform float skipGreyed;
uniform float hasImages;
uniform float imageCount;
uniform float imageAtlasCoordsTextureSize;
uniform float pointMinPixelSize;
uniform float pointDepthCueStrength;
uniform float pointDepthCueSize;
uniform float pointDepthCueBrightness;
uniform float pointDepthCueOpacity;
uniform float pointDepthCueMoat;
uniform float pointDepthCueHighlight;
uniform float pointDepthCueShadow;
uniform float pointDepthCueSaturation;
#endif

out float pointShape;
out float isGreyedOut;
out float isOutlined;
out vec4 shapeColor;
out vec4 imageAtlasUV;
out float shapeSize;
out float imageSizeVarying;
out float overallSize;

float calculatePointSize(float size) {
  float pSize;

  if (scalePointsOnZoom > 0.0) {
    pSize = size * ratio * transformationMatrix[0][0];
  } else {
    pSize = size * ratio;
  }

  return min(pSize, maxPointSize * ratio);
}

const float outlineRingScale = 1.3;

void main() {
  // Read point status texture: R = greyout, G = outlined
  vec4 status = texture(pointStatus, (pointIndices + 0.5) / pointsTextureSize);
  isGreyedOut = status.r;
  isOutlined = status.g;
  float isHighlighted = (status.r == 0.0) ? 1.0 : 0.0;

  // Discard point based on rendering mode
  if (skipHighlighted > 0.0 && isHighlighted > 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }
  if (skipGreyed > 0.0 && isHighlighted <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }

  // Position
  vec4 pointPosition = texture(positionsTexture, (pointIndices + 0.5) / pointsTextureSize);
  vec2 point = pointPosition.rg;

  // Transform point position to normalized device coordinates
  // Convert from space coordinates [0, spaceSize] to normalized [-1, 1]
  vec2 normalizedPosition = 2.0 * point / spaceSize - 1.0;

  // Apply aspect ratio correction - this is needed to map the square space to the rectangular screen
  // The transformation matrix handles zoom/pan, but we need this to handle aspect ratio
  normalizedPosition *= spaceSize / screenSize;

  #ifdef USE_UNIFORM_BUFFERS
  mat3 transformMat3 = mat3(transformationMatrix);
  vec3 finalPosition = transformMat3 * vec3(normalizedPosition, 1);
  #else
  vec3 finalPosition = transformationMatrix * vec3(normalizedPosition, 1);
  #endif
  gl_Position = vec4(finalPosition.rg, 0, 1);

  // Frustum cull: skip points whose sprite is entirely offscreen.
  // Sprite half-extent in NDC = (gl_PointSize_device) / (canvas_device_width).
  // gl_PointSize is at most maxPointSize*ratio device pixels; canvas width is
  // screenSize*ratio device pixels, so the ratios cancel and the NDC half-span
  // simplifies to maxPointSize / screenSize. We use 2x that as a conservative
  // margin (the *2 covers worst-case outlined-ring scaling).
  vec2 cullMargin = 2.0 * vec2(maxPointSize) / screenSize;
  if (abs(gl_Position.x) > 1.0 + cullMargin.x || abs(gl_Position.y) > 1.0 + cullMargin.y) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }

  // Calculate sizes for shape and image
  float shapeSizeValue = calculatePointSize(size * sizeScale);
  float imageSizeValue = calculatePointSize(imageSize * sizeScale);

  // Use the larger of the two sizes for the overall point size
  float overallSizeValue = max(shapeSizeValue, imageSizeValue);

  // Sub-pixel cull BEFORE outline scaling so outlined and non-outlined points
  // share the same cull threshold (prevents popping when hover changes outline).
  if (pointMinPixelSize > 0.0 && overallSizeValue < pointMinPixelSize) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }

  // Scale up point sprite to fit outline ring; clamp to hardware gl_PointSize limit so the
  // sprite never gets silently clipped — the point body is unaffected, only the ring narrows.
  if (isOutlined > 0.0) {
    overallSizeValue *= outlineRingScale;
    overallSizeValue = min(overallSizeValue, maxPointSize * ratio);
  }

  gl_PointSize = overallSizeValue;

  // Pass size information to fragment shader
  shapeSize = shapeSizeValue;
  imageSizeVarying = imageSizeValue;
  overallSize = overallSizeValue;

  shapeColor = color;
  pointShape = shape;

  // Adjust color of greyed-out points
  if (isGreyedOut > 0.0) {
    if (greyoutColor[0] != -1.0) {
      shapeColor = greyoutColor;
    } else {
      // If greyoutColor is not set, make color lighter or darker based on isDarkenGreyout
      float blendFactor = 0.65;

      #ifdef USE_UNIFORM_BUFFERS
      if (isDarkenGreyout > 0.0) {
        shapeColor.rgb = mix(shapeColor.rgb, vec3(0.2), blendFactor);
      } else {
        shapeColor.rgb = mix(shapeColor.rgb, max(backgroundColor.rgb, vec3(0.8)), blendFactor);
      }
      #else
      if (isDarkenGreyout > 0.0) {
        shapeColor.rgb = mix(shapeColor.rgb, vec3(0.2), blendFactor);
      } else {
        shapeColor.rgb = mix(shapeColor.rgb, max(backgroundColor.rgb, vec3(0.8)), blendFactor);
      }
      #endif
    }
  }

  #ifdef USE_UNIFORM_BUFFERS
  if (hasImages <= 0.0 || imageIndex < 0.0 || imageIndex >= imageCount) {
    imageAtlasUV = vec4(-1.0);
  } else {
    float atlasCoordIndex = imageIndex;
    float texX = mod(atlasCoordIndex, imageAtlasCoordsTextureSize);
    float texY = floor(atlasCoordIndex / imageAtlasCoordsTextureSize);
    vec2 atlasCoordTexCoord = (vec2(texX, texY) + 0.5) / imageAtlasCoordsTextureSize;
    vec4 atlasCoords = texture(imageAtlasCoords, atlasCoordTexCoord);
    imageAtlasUV = atlasCoords;
  }
  #else
  if (hasImages <= 0.0 || imageIndex < 0.0 || imageIndex >= imageCount) {
    imageAtlasUV = vec4(-1.0);
  } else {
    float atlasCoordIndex = imageIndex;
    float texX = mod(atlasCoordIndex, imageAtlasCoordsTextureSize);
    float texY = floor(atlasCoordIndex / imageAtlasCoordsTextureSize);
    vec2 atlasCoordTexCoord = (vec2(texX, texY) + 0.5) / imageAtlasCoordsTextureSize;
    vec4 atlasCoords = texture(imageAtlasCoords, atlasCoordTexCoord);
    imageAtlasUV = atlasCoords;
  }
  #endif
}
