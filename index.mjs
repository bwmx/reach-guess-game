import { loadStdlib } from '@reach-sh/stdlib';
import * as backend from './build/index.main.mjs';
const stdlib = loadStdlib(process.env);

const fmt = (x) => stdlib.formatCurrency(x, 4);
const getBalance = async (who) => fmt(await stdlib.balanceOf(who));

const ellipseAddress = (address = "", width = 4) => {
  return `${address.slice(0, width)}...${address.slice(-width)}`;
}

const getRandom = () => {
  return Math.floor(Math.random() * 50 + 1);
}

const startingBalance = stdlib.parseCurrency(100);

const [accAdmin, accBenefactor] = await stdlib.newTestAccounts(2, startingBalance);
console.log('Hello, Admin and Benefactor!');

const benefactorBefore = await getBalance(accBenefactor);
let adminBefore;

console.log('Launching...');
const ctcAdmin = accAdmin.contract(backend);

console.log('Starting Admin backend...');

let gameOver = false;

// reads from the contract view and returns an object
const getStats = async (ctc) => {
  const price = await ctc.unsafeViews.price();
  const totalGuesses = await ctc.unsafeViews.totalGuesses();
  const prizePot = await ctc.unsafeViews.prizePot();

  return { price, totalGuesses, prizePot };
}

const doPlayer = async (accPlayer, ctc, guess) => {
  const addr = ellipseAddress(stdlib.formatAddress(accPlayer));
  const ctcPlayer = accPlayer.contract(backend, ctc);
  const { price, totalGuesses, prizePot } = await getStats(ctcPlayer);

  console.log(`${addr} see's price: ${fmt(price)} ${stdlib.standardUnit} totalGuesses: ${totalGuesses} prizePot: ${fmt(prizePot)} ${stdlib.standardUnit}`);

  const [maybe, winner] = await ctcPlayer.safeApis.Player.guess(guess);
  console.log(`${addr} guessed ${guess} ${winner ? "and won" : "and was wrong"} `)
  // if the user won, stop other players guessing (in simulatePlayers loop)
  if (winner) {
    gameOver = true;
  }
};

const simulatePlayers = async (ctc) => {
  while (!gameOver) {
    const accPlayer = await stdlib.newTestAccount(startingBalance);

    try {
      await doPlayer(accPlayer, ctc, getRandom());
    } catch (error) {
      console.log(`${stdlib.formatAddress(accPlayer)} was unable to guess! game over!` + error.toString());
      break;
    }

    await stdlib.wait(5);
  }
}
const getWinningNumber = () => {
  let num = getRandom();
  console.log("winning number is: " + num);
  return num;
};

await backend.Admin(ctcAdmin, {
  ...stdlib.hasRandom,
  details: {
    winningNumber: getWinningNumber(),
    price: stdlib.parseCurrency(10), // 10 network tokens per guess
    deadline: 30, // number of blocks
    benefactor: accBenefactor.networkAccount
  },
  launched: async (ctcInfo) => {
    console.log(`Contract launched by Admin: ${JSON.stringify(ctcInfo)} `);
    simulatePlayers(ctcInfo);
    // set admin balance after creation
    adminBefore = await getBalance(accAdmin);
  },
  showWinner: async (who) => {
    console.log(`Winner! ${stdlib.formatAddress(who)} balance: ${fmt(startingBalance)} ${stdlib.standardUnit} -> ${await getBalance(who)} ${stdlib.standardUnit}`);
  },
});

console.log(`Benefactor addr ${stdlib.formatAddress(accBenefactor)} balance: ${benefactorBefore} ${stdlib.standardUnit} => ${await getBalance(accBenefactor)} ${stdlib.standardUnit}`);
console.log(`Admin addr ${stdlib.formatAddress(accAdmin)} balance: ${adminBefore} ${stdlib.standardUnit} -> ${await getBalance(accAdmin)} ${stdlib.standardUnit}`);

console.log('Goodbye cruel world!');
