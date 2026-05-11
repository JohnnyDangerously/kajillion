/// <reference types="@webgpu/types" />
declare module '*.frag';
declare module '*.vert';
declare module '*.wgsl';
declare module '*.png' {
    const content: string
    // eslint-disable-next-line import/no-default-export
    export default content
}
declare module '*?raw' {
    const content: string
    // eslint-disable-next-line import/no-default-export
    export default content
  }
