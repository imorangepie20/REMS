/** 카카오맵 SDK는 전역 window.kakao로 노출된다. v1에서는 느슨한 타입으로 둔다. */
declare global {
  interface Window {
    kakao: any
  }
}
export {}
