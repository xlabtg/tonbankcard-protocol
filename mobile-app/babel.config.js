module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: {
          '@lib': './src/lib',
          '@screens': './src/screens',
          '@navigation': './src/navigation',
        },
      },
    ],
  ],
};
