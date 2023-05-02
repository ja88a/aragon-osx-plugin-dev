import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";

const dotenvConfigPath: string = process.env.DOTENV_CONFIG_PATH || "./.env";
dotenvConfig({ path: resolve(__dirname, dotenvConfigPath) });

if (!process.env.ALCHEMY_API_KEY) {
  throw new Error("ALCHEMY_API_KEY in .env not set");
}
const alchemyApiKey = process.env.ALCHEMY_API_KEY || 'KEY_NOT_SET';

if (!process.env.PRIVATE_KEY_GOERLI) {
  console.warn("PRIVATE_KEY_GOERLI in .env not set");
}
const privateKeyGoerli = process.env.PRIVATE_KEY_GOERLI || 'KEY_NOT_SET';

if (!process.env.PRIVATE_KEY_DEVNET) {
  console.warn("PRIVATE_KEY_DEVNET in .env not set");
}
const privateKeyDevnet = process.env.PRIVATE_KEY_DEVNET || 'KEY_NOT_SET';

if (!process.env.DEVNET_RPC) {
  console.warn("DEVNET_RPC in .env not set");
}
const devnetProvider = process.env.DEVNET_RPC || 'URL_NOT_SET';

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {},
    goerli: {
      url: `https://eth-goerli.g.alchemy.com/v2/${alchemyApiKey}`,
      accounts: [privateKeyGoerli],
    },
    devnet: {
      url: devnetProvider,
      accounts: [privateKeyDevnet],
    },
  },
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: {
    timeout: 40000,
  },
};

export default config;
