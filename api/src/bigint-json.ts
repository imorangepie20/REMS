// Prisma BIGINT 컬럼을 JSON으로 직렬화한다 (side-effect 모듈).
// 한국 부동산 금액(최대 수천억 원)과 자동증가 PK는 Number 안전 범위(2^53 ≈ 9×10^15) 내라 손실이 없다.
// PK가 2^53을 넘어갈 일이 생기면 ID를 문자열로 직렬화하는 변환 계층을 별도로 둘 것.
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function () {
  return Number(this as bigint);
};
