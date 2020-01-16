const path = require('path');
const nodeExternals = require('webpack-node-externals');
const configLib = require('./config');

const umdConfig = {
    entry: './src/index.ts',
    output: {
        path: path.resolve(__dirname, 'dist/'),
        filename: 'index.js',
        libraryTarget: 'umd',
        library: configLib.umdName,
        umdNamedDefine: true
    },
    mode: 'production',
    target: 'node',
    externals: [nodeExternals()],
    module: {
        rules: [{
            test: /\.tsx?$/,
            loader: 'ts-loader',
            exclude: /node_modules/,
            options: {
                configFile: '../src/tsconfig.json'
            }
        }]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js', '.json']
    },
    devtool: 'source-map'
};

const bundleConfig = {
    entry: './src/index.ts',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'dexie-encrypted-addon.min.js',
        libraryTarget: 'window',
        library: configLib.umdName,
        umdNamedDefine: true
    },
    mode: 'production',
    target: 'web',
    module: {
        rules: [{
            test: /\.tsx?$/,
            loader: 'ts-loader',
            exclude: /node_modules/,
            options: {
                configFile: '../src/tsconfig.json'
            }
        }]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js', '.json']
    },
    devtool: 'source-map'
};

module.exports = [umdConfig, bundleConfig];