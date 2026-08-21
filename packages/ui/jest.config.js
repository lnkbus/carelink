/** 토큰 대조 테스트만 돌립니다. 컴포넌트 렌더 테스트는 각 앱에 있습니다. */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
};
