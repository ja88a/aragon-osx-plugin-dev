import {
  DAOFactory__factory,
  DAORegistry__factory,
  MajorityVotingBase,
  PluginRepo__factory,
  activeContractsList,
} from "@aragon/osx-ethers";
import { ethers } from "hardhat";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";

/**
 * Deploy an Aragon DAO [with plugins] with token voting based admin
 * 
 * A programmatic alternative to the Aragon app: https://app.aragon.org
 * 
 * Install: ``pnpm install``
 * 
 * Requires: Hardhat config and `./.env` (see `.env.sample`)
 * 
 * Run: ``npx hardhat run --network goerli scripts/deploy-dao.ts``
 */
async function main() {
  // 0. Init local env
  const BN = ethers.BigNumber.from;
  const ZeroAddress = `0x${"00".repeat(20)}`;

  const provider = ethers.getDefaultProvider();
  //const wallet = new ethers.Wallet(privateKey, provider);
  const [deployer] = await ethers.getSigners();
  console.log("Wallet address: ", deployer.address);

  // 1. get the token voting repo. we need this to get the latest version
  // of the token voting app and as well as initialize data
  const tokenVotingRepo = PluginRepo__factory.connect(
    activeContractsList.mainnet["token-voting-repo"],
    deployer
  );
  const latestVersion = await tokenVotingRepo["getLatestVersion(uint8)"](
    await tokenVotingRepo.latestRelease()
  );

  // this points to the current version of the token voting app in the token voting repo
  const setupRef = {
    pluginSetupRepo: tokenVotingRepo.address,
    versionTag: latestVersion.tag,
  };

  // 2. create the setup data for the token voting app
  const voteSettings: MajorityVotingBase.VotingSettingsStruct = {
    votingMode: BN(1), // 0:  Standard, 1: EarlyExecution, 2: VoteReplacement
    supportThreshold: BN((0.5 * 10) ^ 6), // percentages are as numbers with a base of 10**6
    minParticipation: BN((0.1 * 10) ^ 6), // percentages are as numbers with a base of 10**6
    minDuration: BN(60 * 60 * 24), // 1 day
    minProposerVotingPower: BN(0), // anyone can create a vote. this is for testing
  };

  const tokenSettings = {
    addr: ZeroAddress,
    name: "BG Token", // the name of your token
    symbol: "BGTOK", // the symbol for your token. shouldn't be more than 5 letters
    decimals: 18, // the number of decimals your token uses
  };

  const mintSettings = [[deployer.address], [BN((100e18).toString())]];

  // 3. encode the setup data. this is very low level, your better of using the SDK to do this but as
  // a plugin dev you should understand whats happening under the hood. especially as you need to write
  // your own setup data for your plugin. Most plugins will not have so many params though.
  // https://github.com/aragon/osx/blob/527474bb14529f2892e8277f6d7a1ca2da637a55/packages/contracts/src/plugins/governance/majority-voting/token/TokenVotingSetup.sol#L88
  const abiCoder = new ethers.utils.AbiCoder();

  const encodedSetupData = abiCoder.encode(
    [
      "tuple(uint8 votingMode, uint64 supportThreshold, uint64 minParticipation, uint64 minDuration, uint256 minProposerVotingPower) votingSettings",
      "tuple(address addr, string name, string symbol) tokenSettings",
      "tuple(address[] receivers, uint256[] amounts) mintSettings",
    ],
    [voteSettings, tokenSettings, mintSettings]
  );

  const installData = {
    pluginSetupRef: setupRef,
    data: hexToBytes(encodedSetupData),
  };

  // 4. create the DAO
  const daoFactory = DAOFactory__factory.connect(
    activeContractsList.mainnet.DAOFactory,
    deployer
  );
  const daoCreationTx = await daoFactory.createDao(
    {
      metadata: ethers.utils.toUtf8Bytes("ipfs://Qm..."),
      subdomain: `some-dao-w${Math.floor(Math.random() * 1000)}`,
      daoURI: "https://daobox.app",
      trustedForwarder: `0x${"00".repeat(20)}`,
    },
    [installData],
    { gasLimit: 5000000 }
  );

  // 5. wait for the DAO to be created
  const daoReceipt = await daoCreationTx.wait();
  const daoInterface = DAORegistry__factory.createInterface();
  const daoTopic = daoInterface.getEventTopic("DAORegistered");
  const daoLog = daoReceipt.logs.find(
    (x: { topics: string | any[] }) => x.topics.indexOf(daoTopic) >= 0
  );
  if (!daoLog) throw new Error("UH OH");
  const daoAddress = daoInterface.parseLog(daoLog).args.dao;
  console.log(`Deployed DAO at ${daoAddress}`);

  // ----========================= Helper functions =========================---- //

  function hexToBytes(hexString: string): Uint8Array {
    if (!hexString) return new Uint8Array();
    else if (!/^(0x)?[0-9a-fA-F]*$/.test(hexString)) {
      throw new Error("Invalid hex string");
    } else if (hexString.length % 2 !== 0) {
      throw new Error("The hex string has an odd length");
    }

    hexString = strip0x(hexString);
    const bytes = [];
    for (let i = 0; i < hexString.length; i += 2) {
      bytes.push(parseInt(hexString.substring(i, i + 2), 16));
    }
    return Uint8Array.from(bytes);
  }

  function strip0x(value: string): string {
    return value.startsWith("0x") ? value.substring(2) : value;
  }
}

// Pattern enabling to use async/await everywhere and report any errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
